import { createClient } from '@supabase/supabase-js'
import { fromAuth, fromPg } from './errors'
import { isLive } from '../rules'

const POLL_MS = 30000
const COLUMNS = 'id,lat,lng,tag,note,emoji,created_by,reporter_name,reporter_avatar,created_at,expires_at,confirmations,gone_votes,status'

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  let userId = null
  // False until the regions migration has run; then we fall back to loading every pin.
  let regionsReady = true

  async function getProfile() {
    if (!userId) return null
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw fromPg(error)
    return data
  }

  return {
    mode: 'supabase',
    client: sb,
    get userId() { return userId },

    async init() {
      let { data: { session } } = await sb.auth.getSession()
      if (!session) {
        // Anonymous auth gives every device a stable user id for RLS + rate limiting.
        // Phone OTP / Google can later be linked to the same user (feature 9).
        const { data, error } = await sb.auth.signInAnonymously()
        if (error) throw fromAuth(error)
        session = data.session
      }
      userId = session.user.id
      // 20261024010000_regions.sql adds checkpoints.region. Until it has run on this
      // database, keep the old load-everything behaviour so the map isn't empty.
      const probe = await sb.from('checkpoints').select('region').limit(1)
      regionsReady = probe.error?.code !== '42703'
      if (!regionsReady) console.warn('[naaka] checkpoints.region missing: run the regions migration')
      return { userId, profile: await getProfile() }
    },

    getProfile,

    async saveProfile({ username, avatar }) {
      const existing = await getProfile()
      const q = existing
        ? sb.from('profiles').update({ username, avatar }).eq('id', userId)
        : sb.from('profiles').insert({ id: userId, username, avatar })
      const { error } = await q
      if (error) throw fromPg(error)
      return getProfile()
    },

    // Loads and live-subscribes only to pins in `regions` (see regionsAround()).
    // onStatus('live' | 'degraded') reports whether realtime is connected; while
    // degraded (e.g. the project's realtime connection limit is hit) we poll instead.
    subscribeCheckpoints(regions, cb, onStatus = () => {}) {
      const byId = new Map()
      const push = () => cb([...byId.values()].filter((cp) => isLive(cp)))
      const upsert = (row) => {
        if (!row?.id) return
        if (row.status !== 'active') byId.delete(row.id)
        else byId.set(row.id, row)
      }

      const load = async () => {
        let q = sb.from('checkpoints').select(COLUMNS)
        if (regionsReady) q = q.in('region', regions)
        const { data, error } = await q
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
        if (error) return console.warn('[naaka] load failed', error)
        byId.clear()
        data.forEach(upsert)
        push()
      }

      let poll = null
      const startPolling = () => {
        if (poll) return
        onStatus('degraded')
        load()
        poll = setInterval(load, POLL_MS)
      }
      const stopPolling = () => {
        clearInterval(poll)
        poll = null
        onStatus('live')
      }

      // No DELETE listener: deletes can't be filtered by region (they'd fan out to
      // everyone). Pins are flipped to status 'expired' / 'cleared' (an UPDATE) well
      // before the cleanup job deletes them, and the local tick hides expired ones.
      const scope = regionsReady ? { filter: `region=in.(${regions.join(',')})` } : {}
      const onChange = (payload) => { upsert(payload.new); push() }
      // Unique name per subscription: supabase-js reuses channels by name, which breaks
      // a second subscriber (or React StrictMode's mount → unmount → mount).
      let channel = sb
        .channel(`checkpoints-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkpoints', ...scope }, onChange)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkpoints', ...scope }, onChange)
      if (!regionsReady) {
        channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checkpoints' }, (payload) => {
          byId.delete(payload.old.id)
          push()
        })
      }
      channel = channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Re-sync after (re)connecting so nothing is missed while offline.
            stopPolling()
            load()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // supabase-js keeps retrying the channel on its own; poll until it gets back in.
            if (err) console.warn('[naaka] realtime', status, err.message)
            startPolling()
          }
        })

      // Show pins right away instead of waiting for the realtime join.
      load()

      // Local expiry tick: pins disappear the moment expires_at passes,
      // without waiting for the server cron to flip their status.
      const tick = setInterval(push, 15000)
      const onVisible = () => document.visibilityState === 'visible' && load()
      document.addEventListener('visibilitychange', onVisible)

      return () => {
        clearInterval(tick)
        clearInterval(poll)
        document.removeEventListener('visibilitychange', onVisible)
        sb.removeChannel(channel)
      }
    },

    async myVotes() {
      const { data, error } = await sb.from('votes').select('checkpoint_id,type').eq('user_id', userId)
      if (error) return {}
      return Object.fromEntries(data.map((v) => [v.checkpoint_id, v.type]))
    },

    async report({ lat, lng, tag, note, emoji }) {
      const { data, error } = await sb.rpc('report_checkpoint', {
        p_lat: lat, p_lng: lng, p_tag: tag, p_note: note || null, p_emoji: emoji || null,
      })
      if (error) throw fromPg(error)
      return data
    },

    async vote(id, type) {
      const { data, error } = await sb.rpc('vote_checkpoint', { p_id: id, p_type: type })
      if (error) throw fromPg(error)
      return data
    },

    async markSeen(checkpointId) {
      await sb.from('alerts_seen').upsert({ user_id: userId, checkpoint_id: checkpointId }, { ignoreDuplicates: true })
    },
  }
}
