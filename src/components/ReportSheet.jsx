import { useState } from 'react'
import Sheet from './Sheet'
import { NOTE_MAX, REACTIONS, TAGS, TAG_ICONS } from '../lib/rules'

export default function ReportSheet({ open, onClose, onSubmit, t, at, firstTime, busy }) {
  const [tag, setTag] = useState('general')
  const [note, setNote] = useState('')
  const [emoji, setEmoji] = useState(null)

  const submit = async () => {
    const ok = await onSubmit({ tag, note: note.trim(), emoji })
    if (ok) {
      setNote('')
      setEmoji(null)
      setTag('general')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('dropPin')}>
      {firstTime && (
        <div className="mb-3 rounded-2xl border border-neon-yellow/60 bg-neon-yellow/15 p-3 text-sm font-semibold">
          🛑 Don’t use while driving — pull over first. No pin is worth a crash.
        </div>
      )}
      <p className="mb-3 text-sm opacity-70">
        {at?.source === 'map'
          ? '📍 At the spot you long-pressed'
          : at?.source === 'search'
            ? `📍 At ${at.label}`
            : '📍 At your current location'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {TAGS.map((id) => (
          <button
            key={id}
            onClick={() => setTag(id)}
            className={`flex min-h-[56px] items-center gap-2 rounded-2xl border-2 px-3 text-left text-[15px] font-semibold transition active:scale-95 ${
              tag === id
                ? 'border-neon-pink bg-neon-pink/15 shadow-neon'
                : 'border-black/10 bg-black/[.03] dark:border-white/10 dark:bg-white/5'}`}
          >
            <span className="text-2xl">{TAG_ICONS[id]}</span>
            {t(`tags.${id}`)}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 flex justify-between text-sm opacity-70">
          <span>Note (optional)</span>
          <span>{note.length}/{NOTE_MAX}</span>
        </span>
        <input
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Right after the flyover, 3 cops"
          className="w-full rounded-2xl border border-black/10 bg-black/[.03] px-4 py-3 text-base outline-none focus:border-neon-cyan dark:border-white/10 dark:bg-white/5"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setEmoji(emoji === r ? null : r)}
            className={`h-12 w-12 rounded-full text-2xl transition active:scale-90 ${emoji === r ? 'bg-neon-green/30 ring-2 ring-neon-green' : 'bg-black/5 dark:bg-white/5'}`}
            aria-pressed={emoji === r}
          >
            {r}
          </button>
        ))}
      </div>

      <button
        disabled={busy}
        onClick={submit}
        className="mt-5 h-16 w-full rounded-2xl bg-neon-pink text-lg font-bold text-white shadow-neon transition active:scale-[.98] disabled:opacity-50"
      >
        {busy ? 'Dropping…' : t('dropPin')}
      </button>
    </Sheet>
  )
}
