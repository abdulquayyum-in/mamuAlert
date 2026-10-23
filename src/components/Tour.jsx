import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// First-run spotlight tour. Each step points at an element (CSS selector);
// steps whose target isn't on screen fall back to a centred card.
const PAD = 8
const GAP = 14

function buildSteps({ t, username }) {
  return [
    {
      title: `Welcome, ${username} 👋`,
      body: 'NaakaAlert is a live map of traffic checkpoints (naakas), dropped by commuters like you. Quick 30-second tour?',
      cta: 'Show me',
    },
    {
      target: '.me',
      title: 'This is you 😎',
      body: 'Your live location. It stays on your phone and is only used while the app is open. The dashed circle is your alert zone.',
    },
    {
      target: '.leaflet-marker-icon .pin',
      title: 'Pins = live naakas 🚨',
      body: 'The ring shrinks as a pin gets older, and every pin disappears within 2 hours. Tap one to see details, then vote 👀 still there or 💨 gone.',
      fallback: 'When someone spots a naaka near you, it shows up here as a pin with a countdown ring. Tap it to vote 👀 still there or 💨 gone.',
    },
    {
      target: '[data-tour="drop"]',
      title: `${t('dropPin')}`,
      body: 'Spotted one? Tap to pin it at your location, pick a tag, done. You can also long-press anywhere on the map. 🛑 Pull over first, never while riding.',
    },
    {
      target: '[data-tour="search"]',
      title: 'Search a place 🔍',
      body: 'Not there right now? Search a junction or landmark, drag the 📍 to the exact spot, and drop the pin.',
    },
    {
      target: '[data-tour="vibe"]',
      title: 'Vibe Check ✅',
      body: 'A 10-second pre-ride checklist: helmet, licence, RC, PUC, sober. Tick them all for a little surprise.',
    },
    {
      target: '[data-tour="recenter"]',
      title: 'Back to you 🎯',
      body: 'Scrolled away? This brings the map back to where you are.',
    },
    {
      target: '[data-tour="settings"]',
      title: 'Make it yours ⚙️',
      body: 'Vibe language (English, Hinglish, Hyderabadi), alert sound or voice pack, alert radius, dark/light mode and notifications.',
    },
    {
      target: '[data-tour="profile"]',
      title: 'Earn points 🏆',
      body: '+10 for every new pin, +5 for confirming someone else’s. Fake pins that get cleared cost you points, so keep it legit.',
    },
    {
      title: 'You’re all set 🫡',
      body: 'When you get close to a naaka, you’ll get a banner, a buzz and a meme. Ride legal, ride safe.',
      cta: 'Let’s go 🚀',
    },
  ]
}

function findTarget(selector) {
  if (!selector) return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  // First matching element that is actually visible on screen.
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh) return r
  }
  return null
}

export default function Tour({ open, onDone, t, username }) {
  const steps = buildSteps({ t, username })
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i]

  useEffect(() => { if (open) setI(0) }, [open])

  // Track the target's position (map markers move as tiles settle / on resize).
  useLayoutEffect(() => {
    if (!open) return
    const update = () => setRect(findTarget(step.target))
    update()
    const tm = setInterval(update, 250)
    window.addEventListener('resize', update)
    return () => { clearInterval(tm); window.removeEventListener('resize', update) }
  }, [open, step.target])

  const next = useCallback(() => (i < steps.length - 1 ? setI(i + 1) : onDone()), [i, steps.length, onDone])
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, next, back, onDone])

  if (!open) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(340, vw - 32)
  const hole = rect && {
    left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  }

  // Card below the target if there's room, otherwise above; centred when there's no target.
  let cardStyle
  if (hole) {
    const left = Math.min(Math.max(hole.left + hole.width / 2 - cardW / 2, 16), vw - cardW - 16)
    const below = hole.top + hole.height + GAP
    cardStyle = below + 230 < vh
      ? { left, top: below, width: cardW }
      : { left, bottom: vh - hole.top + GAP, width: cardW }
  } else {
    cardStyle = { left: (vw - cardW) / 2, top: '50%', transform: 'translateY(-50%)', width: cardW }
  }

  const body = !rect && step.fallback ? step.fallback : step.body
  const last = i === steps.length - 1

  return (
    <div className="fixed inset-0 z-[1400]" role="dialog" aria-modal="true" aria-label="App tour">
      {/* Dimmer with a cut-out around the target. Clicks on it are swallowed so the app can't be poked mid-tour. */}
      {hole ? (
        <div
          className="tour-hole pointer-events-none fixed rounded-2xl ring-2 ring-neon-pink transition-all duration-300"
          style={{ ...hole, boxShadow: '0 0 0 9999px rgba(4,4,10,.72), 0 0 24px rgba(255,46,136,.7)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(4,4,10,.72)]" />
      )}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        key={i}
        className="tour-card fixed rounded-3xl bg-white p-4 text-ink-900 shadow-2xl dark:bg-ink-700 dark:text-white"
        style={cardStyle}
      >
        <div className="mb-1 flex items-center justify-between text-xs font-semibold opacity-60">
          <span>{i + 1} / {steps.length}</span>
          {!last && <button onClick={onDone} className="-m-2 p-2">Skip tour</button>}
        </div>
        <h3 className="text-lg font-bold leading-snug">{step.title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed opacity-80">{body}</p>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {steps.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-neon-pink' : 'w-1.5 bg-black/15 dark:bg-white/20'}`} />
            ))}
          </div>
          {i > 0 && !last && (
            <button onClick={back} className="h-11 rounded-xl px-3 font-semibold opacity-70">Back</button>
          )}
          <button onClick={next} className="h-11 rounded-xl bg-neon-pink px-5 font-bold text-white shadow-neon active:scale-95">
            {step.cta || (last ? 'Done' : 'Next')}
          </button>
        </div>
      </div>
    </div>
  )
}
