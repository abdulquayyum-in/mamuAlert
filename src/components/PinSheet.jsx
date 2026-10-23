import Sheet from './Sheet'
import { TAG_ICONS, vibeLevel } from '../lib/rules'
import { distanceM, formatDistance, formatMinutes } from '../lib/geo'

const VIBE_STYLES = ['bg-neon-yellow', 'bg-neon-cyan', 'bg-neon-green']

export function VibeMeter({ cp, t }) {
  const level = vibeLevel(cp)
  const labels = t('vibe')
  return (
    <div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-2.5 flex-1 rounded-full ${i <= level ? VIBE_STYLES[level] : 'bg-black/10 dark:bg-white/10'}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold opacity-80">
        {labels.map((l, i) => <span key={l} className={i === level ? '' : 'opacity-40'}>{l}</span>)}
      </div>
    </div>
  )
}

export default function PinSheet({ cp, onClose, t, pos, myVote, onVote, onShare, busy, demo, onFakeGone }) {
  if (!cp) return null
  const left = new Date(cp.expires_at).getTime() - Date.now()
  const ago = Date.now() - new Date(cp.created_at).getTime()
  const dist = pos ? formatDistance(distanceM(pos, cp)) : null

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-neon-pink/20 text-3xl">{TAG_ICONS[cp.tag]}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight">{t(`tags.${cp.tag}`)} {cp.emoji}</h2>
          <p className="text-sm opacity-70">
            {cp.reporter_avatar} {cp.reporter_name || 'anon'} · {formatMinutes(ago)} ago{dist ? ` · ${dist}` : ''}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-bold text-neon-green">{formatMinutes(left)}</div>
          <div className="opacity-60">left</div>
        </div>
      </div>

      {cp.note && <p className="mt-3 rounded-2xl bg-black/5 px-4 py-3 dark:bg-white/5">“{cp.note}”</p>}

      <div className="mt-4">
        <VibeMeter cp={cp} t={t} />
        <p className="mt-1 text-xs opacity-60">👀 {cp.confirmations} confirmed · 💨 {cp.gone_votes} say gone (3 clears it)</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          disabled={busy}
          onClick={() => onVote(cp.id, 'still_there')}
          className={`h-16 rounded-2xl text-lg font-bold transition active:scale-95 disabled:opacity-50 ${
            myVote === 'still_there' ? 'bg-neon-green text-ink-900 shadow-neon-green' : 'border-2 border-neon-green/60 text-emerald-600 dark:text-neon-green'}`}
        >
          {t('stillThere')}
        </button>
        <button
          disabled={busy}
          onClick={() => onVote(cp.id, 'gone')}
          className={`h-16 rounded-2xl text-lg font-bold transition active:scale-95 disabled:opacity-50 ${
            myVote === 'gone' ? 'bg-neon-cyan text-ink-900' : 'border-2 border-neon-cyan/60 text-cyan-600 dark:text-neon-cyan'}`}
        >
          {t('gone')}
        </button>
      </div>

      <button onClick={() => onShare(cp)} className="mt-3 h-12 w-full rounded-2xl bg-black/5 font-semibold active:scale-[.98] dark:bg-white/10">
        📤 Share meme card
      </button>
      {demo && (
        <button onClick={() => onFakeGone(cp.id)} className="mt-2 h-10 w-full rounded-2xl text-sm opacity-60">
          🧪 Demo: simulate 2 other users voting “gone”
        </button>
      )}
    </Sheet>
  )
}
