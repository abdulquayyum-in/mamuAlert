import { useCallback, useEffect, useRef } from 'react'
import { distanceM } from '../lib/geo'
import { load, save } from '../lib/storage'

const KEY = 'naaka.alertsSeen'
const KEEP_MS = 3 * 60 * 60 * 1000

// Fires onAlert(cp, distance) once per pin per user when within `radius`.
export function useProximityAlerts({ pos, checkpoints, radius, enabled, userId, onAlert }) {
  const seen = useRef(null)
  if (seen.current === null) {
    const now = Date.now()
    seen.current = Object.fromEntries(Object.entries(load(KEY, {})).filter(([, t]) => now - t < KEEP_MS))
  }
  const cb = useRef(onAlert)
  cb.current = onAlert

  useEffect(() => {
    if (!enabled || !pos) return
    const hits = checkpoints
      .filter((cp) => !seen.current[cp.id] && cp.created_by !== userId)
      .map((cp) => ({ cp, d: distanceM(pos, cp) }))
      .filter(({ d }) => d <= radius)
      .sort((a, b) => a.d - b.d)
    if (!hits.length) return
    hits.forEach(({ cp }) => { seen.current[cp.id] = Date.now() })
    save(KEY, seen.current)
    // Only surface the nearest one; the rest are marked seen to avoid a spam burst.
    cb.current(hits[0].cp, hits[0].d, hits.length)
  }, [pos, checkpoints, radius, enabled, userId])

  // Lets the app suppress alerts for pins the user just reported themselves.
  const markSeen = useCallback((id) => {
    seen.current[id] = Date.now()
    save(KEY, seen.current)
  }, [])
  return { markSeen }
}
