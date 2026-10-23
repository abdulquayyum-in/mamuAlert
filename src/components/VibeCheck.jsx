import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import Sheet from './Sheet'

const ITEMS = [
  ['helmet', '⛑️', 'Helmet (rider + pillion)'],
  ['licence', '🪪', 'Driving licence'],
  ['rc', '📄', 'RC + insurance'],
  ['puc', '🌫️', 'PUC certificate'],
  ['sober', '🧃', 'Sober (only chai today)'],
]
const SLAY = ['Fully legal, fully slay 💅', 'Challan? Never heard of her', 'Main character, zero fines 🫡']

export default function VibeCheck({ open, onClose }) {
  const [ticked, setTicked] = useState({})
  const all = ITEMS.every(([id]) => ticked[id])
  const [line] = useState(() => SLAY[Math.floor(Math.random() * SLAY.length)])

  useEffect(() => {
    if (all && open) confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors: ['#ff2e88', '#39ff88', '#22e4ff', '#ffe14d'] })
  }, [all, open])

  return (
    <Sheet open={open} onClose={onClose} title="Vibe Check before the ride ✅">
      <div className="space-y-2">
        {ITEMS.map(([id, icon, label]) => (
          <button key={id} onClick={() => setTicked((s) => ({ ...s, [id]: !s[id] }))} aria-pressed={!!ticked[id]}
            className={`flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-semibold transition active:scale-[.98] ${
              ticked[id] ? 'bg-neon-green/20 ring-2 ring-neon-green' : 'bg-black/5 dark:bg-white/5'}`}>
            <span className="text-2xl">{icon}</span>
            <span className="flex-1">{label}</span>
            <span className="text-xl">{ticked[id] ? '✅' : '⬜'}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-black/5 p-4 text-center text-lg font-bold dark:bg-white/5">
        {all ? line : ticked.sober === false ? 'Not sober? Cab it, bestie 🚕' : 'Tick ’em all, legend'}
      </div>
      <button onClick={onClose} className="mt-3 h-12 w-full rounded-2xl font-semibold opacity-70">Done</button>
    </Sheet>
  )
}
