import { createClient } from '@supabase/supabase-js'
import { AppError, fromPg } from './errors'
import { isLive } from '../rules'

const COLUMNS = 'id,lat,lng,tag,note,emoji,created_by,reporter_name,reporter_avatar,created_at,expires_at,confirmations,gone_votes,status'

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  let userId = null

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
        if (error) throw new AppError('auth_failed', { cause: error })
        session = data.session
      }
      userId = session.user.id
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

    subscribeCheckpoints(cb) {
      const byId = new Map()
      const push = () => cb([...byId.values()].filter((cp) => isLive(cp)))
      const upsert = (row) => {
        if (!row?.id) return
        if (row.status !== 'active') byId.delete(row.id)
        else byId.set(row.id, row)
      }

      const load = async () => {
        const { data, error } = await sb
          .from('checkpoints')
          .select(COLUMNS)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
        if (error) return console.warn('[naaka] load failed', error)
        byId.clear()
        data.forEach(upsert)
        push()
      }

      const channel = sb
        // Unique name per subscription: supabase-js reuses channels by name, which breaks
        // a second subscriber (or React StrictMode's mount → unmount → mount).
        .channel(`checkpoints-live-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkpoints' }, (payload) => {
          if (payload.eventType === 'DELETE') byId.delete(payload.old.id)
          else upsert(payload.new)
          push()
        })
        .subscribe((status) => {
          // Re-sync after (re)connecting so nothing is missed while offline.
          if (status === 'SUBSCRIBED') load()
        })

      // Local expiry tick: pins disappear the moment expires_at passes,
      // without waiting for the server cron to flip their status.
      const tick = setInterval(push, 15000)
      const onVisible = () => document.visibilityState === 'visible' && load()
      document.addEventListener('visibilitychange', onVisible)

      return () => {
        clearInterval(tick)
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
