import { useState } from 'react'
import ProductHuntBadge from './ProductHuntBadge'

const AVATARS = ['😎', '🛵', '🦉', '🐸', '🤡', '👽', '🦊', '🐼', '🍗', '☕', '🛺', '🥷', '🐒', '💀', '🧢', '🫡']
const A = ['Chai', 'Biryani', 'Gully', 'Turbo', 'Midnight', 'Sneaky', 'Desi', 'Nawabi', 'Chill', 'Masala']
const B = ['Ninja', 'Scout', 'Rider', 'Owl', 'Bandit', 'Mamu', 'Bhai', 'Legend', 'Pilot', 'Wala']

const suggest = () => `${A[Math.floor(Math.random() * A.length)]}${B[Math.floor(Math.random() * B.length)]}${Math.floor(Math.random() * 90 + 10)}`

export default function ProfileSetup({ initial, onSave, onCancel, demo }) {
  const [username, setUsername] = useState(initial?.username || suggest())
  const [avatar, setAvatar] = useState(initial?.avatar || AVATARS[0])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const valid = /^[A-Za-z0-9_.]{3,24}$/.test(username)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave({ username, avatar })
    } catch (e) {
      setError(e.code === 'username_taken' ? 'That name’s taken, pick another 😅' : 'Could not save, try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-ink-900/95 p-4 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">
          {initial ? 'Edit your vibe' : <>Welcome to <span className="text-neon-pink">Naaka</span><span className="text-neon-green">Alert</span> 🚨</>}
        </h1>
        <p className="mt-2 text-white/70">
          Pick an anon name + avatar. That’s all anyone ever sees — never your phone or real name.
        </p>

        <div className="mt-6 grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <button key={a} onClick={() => setAvatar(a)} aria-pressed={avatar === a}
              className={`aspect-square rounded-xl text-xl transition active:scale-90 ${avatar === a ? 'bg-neon-pink shadow-neon' : 'bg-white/5'}`}>
              {a}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} maxLength={24}
            className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus:border-neon-cyan" aria-label="Username" />
          <button onClick={() => setUsername(suggest())} className="rounded-2xl bg-white/10 px-4 text-2xl" aria-label="Random name">🎲</button>
        </div>
        {!valid && <p className="mt-1 text-sm text-neon-yellow">3–24 letters, numbers, _ or .</p>}
        {error && <p className="mt-1 text-sm text-neon-yellow">{error}</p>}

        <button disabled={!valid || busy} onClick={save}
          className="mt-6 h-14 w-full rounded-2xl bg-neon-green text-lg font-bold text-ink-900 shadow-neon-green disabled:opacity-40">
          {busy ? 'Saving…' : initial ? 'Save' : 'Let’s gooo 🚀'}
        </button>
        {onCancel && <button onClick={onCancel} className="mt-2 h-12 w-full text-white/60">Cancel</button>}
        {!initial && (
          <div className="mt-6 flex justify-center">
            <ProductHuntBadge theme="dark" />
          </div>
        )}
        {demo && !initial && (
          <p className="mt-4 text-center text-xs text-white/40">Offline demo mode — data stays in this browser. Add Supabase keys for real-time sync.</p>
        )}
      </div>
    </div>
  )
}
