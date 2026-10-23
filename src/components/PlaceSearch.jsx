import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/geocode'
import { distanceM, formatDistance } from '../lib/geo'

export default function PlaceSearch({ open, onClose, onPick, near }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [state, setState] = useState('idle') // idle | loading | done | error
  const input = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) {
      setResults([])
      setState('idle')
      return
    }
    const ctrl = new AbortController()
    const tm = setTimeout(async () => {
      setState('loading')
      try {
        setResults(await searchPlaces(query, { near, signal: ctrl.signal }))
        setState('done')
      } catch (e) {
        if (e.name !== 'AbortError') setState('error')
      }
    }, 400)
    return () => {
      clearTimeout(tm)
      ctrl.abort()
    }
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const close = () => {
    setQ('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1050] flex flex-col bg-black/50 backdrop-blur-[2px]" role="dialog" aria-label="Search a place">
      <div className="banner-enter bg-white px-3 pb-3 shadow-2xl safe-top dark:bg-ink-800">
        <div className="flex items-center gap-2">
          <button onClick={close} aria-label="Back" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl">←</button>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && results[0] && onPick(results[0])}
            placeholder="Search a road, junction, landmark…"
            enterKeyHint="search"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 bg-black/[.03] px-4 text-base outline-none focus:border-neon-cyan dark:border-white/10 dark:bg-white/5"
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear" className="grid h-12 w-10 shrink-0 place-items-center text-lg opacity-60">✕</button>
          )}
        </div>

        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          {state === 'idle' && <p className="px-2 py-3 text-sm opacity-60">Type at least 3 letters — e.g. “Tank Bund”, “Silk Board junction”</p>}
          {state === 'loading' && results.length === 0 && <p className="px-2 py-3 text-sm opacity-60">Searching… 🔍</p>}
          {state === 'error' && <p className="px-2 py-3 text-sm text-amber-600 dark:text-neon-yellow">Search is down rn 😭 — long-press the map instead</p>}
          {state === 'done' && results.length === 0 && <p className="px-2 py-3 text-sm opacity-60">No match. Try a nearby landmark?</p>}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-black/5 dark:active:bg-white/10"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neon-pink/15 text-lg">📍</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.main}</span>
                {r.sub && <span className="block truncate text-sm opacity-60">{r.sub}</span>}
              </span>
              {near && <span className="shrink-0 text-xs font-semibold opacity-60">{formatDistance(distanceM(near, r))}</span>}
            </button>
          ))}
        </div>
      </div>
      <button className="flex-1" aria-label="Close search" onClick={close} />
    </div>
  )
}
