// Shared product rules. The Supabase SQL mirrors these numbers; keep them in sync.
export const MIN = 60 * 1000
export const BASE_TTL_MS = 60 * MIN
export const EXTEND_MS = 15 * MIN
export const MAX_TTL_MS = 120 * MIN
export const RATE_LIMIT_MS = 5 * MIN
export const MERGE_RADIUS_M = 150
export const GONE_THRESHOLD = 3
export const NOTE_MAX = 80
export const DEFAULT_ALERT_RADIUS_M = 500

export const TAGS = ['helmet', 'documents', 'breath', 'speed', 'diversion', 'general']
export const TAG_ICONS = {
  helmet: '⛑️',
  documents: '📄',
  breath: '🍺',
  speed: '📸',
  diversion: '🚧',
  general: '🚨',
}
export const REACTIONS = ['💀', '😭', '🫠', '🤡', '😤', '🙏', '👮', '🔥']

export function expiryFor(createdAtMs, confirmations) {
  return Math.min(
    createdAtMs + BASE_TTL_MS + Math.max(confirmations - 1, 0) * EXTEND_MS,
    createdAtMs + MAX_TTL_MS,
  )
}

export function isLive(cp, now = Date.now()) {
  return cp.status === 'active' && new Date(cp.expires_at).getTime() > now
}

// Credibility vibe meter: 0 = Sus, 1 = Legit, 2 = 100% Fr Fr
export function vibeLevel(cp) {
  const c = cp.confirmations || 0
  const g = cp.gone_votes || 0
  if (g >= c || c <= 1) return 0
  if (c >= 4 && g === 0) return 2
  return 1
}

// Fraction (0..1) of life left, for the countdown ring.
export function lifeLeft(cp, now = Date.now()) {
  const created = new Date(cp.created_at).getTime()
  const expires = new Date(cp.expires_at).getTime()
  const total = Math.max(expires - created, 1)
  return Math.max(0, Math.min(1, (expires - now) / total))
}
