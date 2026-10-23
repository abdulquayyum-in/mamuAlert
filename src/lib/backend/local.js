// Offline demo backend: same contract as the Supabase backend, stored in
// localStorage and synced across tabs with BroadcastChannel. Used when no
// VITE_SUPABASE_URL is configured, so the app runs with zero setup.
import { AppError } from './errors'
import { load, save } from '../storage'
import { distanceM, jitter } from '../geo'
import {
  BASE_TTL_MS, GONE_THRESHOLD, MERGE_RADIUS_M, MIN, NOTE_MAX, RATE_LIMIT_MS, TAGS, expiryFor, isLive,
} from '../rules'

const K_CP = 'naaka.demo.checkpoints'
const K_USER = 'naaka.demo.user'
const K_PROFILE = 'naaka.demo.profile'

export function createLocalBackend() {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('naaka-demo') : null
  const listeners = new Set()
  let userId = load(K_USER, null)
  if (!userId) {
    userId = crypto.randomUUID()
    save(K_USER, userId)
  }

  const readAll = () => load(K_CP, [])
  const emit = () => {
    const live = readAll().filter((cp) => isLive(cp))
    listeners.forEach((cb) => cb(live))
  }
  const writeAll = (list) => {
    save(K_CP, list)
    emit()
    channel?.postMessage('changed')
  }
  channel?.addEventListener('message', emit)

  const getProfile = () => load(K_PROFILE, null)
  const bumpProfile = (patch) => {
    const p = getProfile()
    if (!p) return
    save(K_PROFILE, { ...p, ...patch(p) })
  }

  function recount(cp) {
    const votes = Object.values(cp.votes || {})
    const conf = votes.filter((v) => v === 'still_there').length
    const gone = votes.filter((v) => v === 'gone').length
    const wasActive = cp.status === 'active'
    cp.confirmations = conf
    cp.gone_votes = gone
    cp.expires_at = new Date(expiryFor(new Date(cp.created_at).getTime(), conf)).toISOString()
    if (gone >= GONE_THRESHOLD && wasActive) cp.status = 'cleared'
    return cp
  }

  function purge(list) {
    // Mirrors cleanup_checkpoints(): mark expired, drop rows finished > 10 min ago.
    const now = Date.now()
    return list
      .map((cp) => (cp.status === 'active' && new Date(cp.expires_at).getTime() <= now
        ? { ...cp, status: 'expired', ended_at: new Date(now).toISOString() } : cp))
      .filter((cp) => cp.status === 'active' || now - new Date(cp.ended_at || cp.expires_at).getTime() < 10 * MIN)
  }

  return {
    mode: 'demo',
    userId,

    async init() {
      return { userId, profile: getProfile() }
    },

    async getProfile() {
      return getProfile()
    },

    async saveProfile({ username, avatar }) {
      const prev = getProfile() || { id: userId, points: 0, badges: [], streak_days: 0, created_at: new Date().toISOString() }
      const p = { ...prev, username, avatar }
      save(K_PROFILE, p)
      return p
    },

    subscribeCheckpoints(cb) {
      listeners.add(cb)
      cb(readAll().filter((cp) => isLive(cp)))
      const t = setInterval(() => {
        const before = readAll()
        const after = purge(before)
        if (after.length !== before.length || after.some((c, i) => c.status !== before[i]?.status)) save(K_CP, after)
        emit()
      }, 15000)
      return () => {
        listeners.delete(cb)
        clearInterval(t)
      }
    },

    async myVotes() {
      const out = {}
      readAll().forEach((cp) => { if (cp.votes?.[userId]) out[cp.id] = cp.votes[userId] })
      return out
    },

    async report({ lat, lng, tag = 'general', note, emoji }) {
      const profile = getProfile()
      if (!profile) throw new AppError('profile_required')
      const last = profile.last_report_at ? new Date(profile.last_report_at).getTime() : 0
      if (Date.now() - last < RATE_LIMIT_MS) {
        throw new AppError('rate_limited', { waitSec: Math.ceil((last + RATE_LIMIT_MS - Date.now()) / 1000) })
      }
      note = (note || '').trim() || null
      if (note && note.length > NOTE_MAX) throw new AppError('note_too_long')

      const list = purge(readAll())
      const here = { lat, lng }
      const near = list
        .filter((cp) => isLive(cp))
        .map((cp) => ({ cp, d: distanceM(here, cp) }))
        .filter(({ d }) => d <= MERGE_RADIUS_M)
        .sort((a, b) => a.d - b.d)[0]

      const nowIso = new Date().toISOString()
      if (near) {
        near.cp.votes = { ...near.cp.votes, [userId]: 'still_there' }
        recount(near.cp)
        writeAll(list)
        bumpProfile((p) => ({ last_report_at: nowIso, points: p.points + 5 }))
        return { merged: true, checkpoint: near.cp }
      }

      const cp = {
        id: crypto.randomUUID(),
        lat, lng, tag, note, emoji: emoji || null,
        created_by: userId,
        reporter_name: profile.username,
        reporter_avatar: profile.avatar,
        created_at: nowIso,
        expires_at: new Date(Date.now() + BASE_TTL_MS).toISOString(),
        confirmations: 1,
        gone_votes: 0,
        status: 'active',
        votes: { [userId]: 'still_there' },
      }
      list.push(cp)
      writeAll(list)
      bumpProfile((p) => ({ last_report_at: nowIso, points: p.points + 10 }))
      return { merged: false, checkpoint: cp }
    },

    async vote(id, type) {
      const list = readAll()
      const cp = list.find((c) => c.id === id)
      if (!cp || !isLive(cp)) throw new AppError('checkpoint_inactive')
      const prev = cp.votes?.[userId]
      cp.votes = { ...cp.votes, [userId]: type }
      recount(cp)
      if (cp.status === 'cleared') cp.ended_at = new Date().toISOString()
      writeAll(list)
      if (!prev && cp.created_by !== userId) bumpProfile((p) => ({ points: p.points + 5 }))
      return cp
    },

    async markSeen() {
      /* alerts_seen is tracked client-side in demo mode */
    },

    // Demo-only: fake other commuters dropping pins around you.
    spawnDemo(center, count = 4) {
      const names = [['ChaiSutta_Rider', '🛵'], ['BiryaniBandit', '🍗'], ['NoHelmetNoLife', '⛑️'], ['GullyScout99', '🦉'], ['AutoWaleBhaiya', '🛺']]
      const list = purge(readAll())
      for (let i = 0; i < count; i++) {
        const [name, avatar] = names[Math.floor(Math.random() * names.length)]
        const p = jitter(center, 300 + Math.random() * 1500)
        const conf = 1 + Math.floor(Math.random() * 5)
        const votes = {}
        for (let v = 0; v < conf; v++) votes[`demo-${i}-${v}`] = 'still_there'
        const ageMs = Math.random() * 40 * MIN
        const cp = {
          id: crypto.randomUUID(),
          ...p,
          tag: TAGS[Math.floor(Math.random() * TAGS.length)],
          note: Math.random() > 0.5 ? 'Near the signal, 4-5 cops' : null,
          emoji: null,
          created_by: `demo-${i}`,
          reporter_name: name,
          reporter_avatar: avatar,
          created_at: new Date(Date.now() - ageMs).toISOString(),
          status: 'active',
          votes,
        }
        list.push(recount(cp))
      }
      writeAll(list)
    },

    // Demo-only: simulate two other users voting "gone" so you can test early clear.
    fakeGoneVotes(id, n = 2) {
      const list = readAll()
      const cp = list.find((c) => c.id === id)
      if (!cp) return
      for (let i = 0; i < n; i++) cp.votes = { ...cp.votes, [`ghost-${Date.now()}-${i}`]: 'gone' }
      recount(cp)
      writeAll(list)
    },
  }
}
