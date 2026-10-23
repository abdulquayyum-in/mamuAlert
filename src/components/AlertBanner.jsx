import { useEffect } from 'react'
import { TAG_ICONS } from '../lib/rules'
import { formatDistance } from '../lib/geo'

export default function AlertBanner({ alert, t, onView, onShare, onClose }) {
  useEffect(() => {
    if (!alert) return
    const tm = setTimeout(onClose, alert.cp.tag === 'breath' ? 20000 : 12000)
    return () => clearTimeout(tm)
  }, [alert, onClose])
  if (!alert) return null
  const { cp, distance, caption, more } = alert
  const breath = cp.tag === 'breath'

  return (
    <div className="fixed inset-x-0 top-0 z-[1100] px-3 safe-top" role="alert">
      <div className={`banner-enter rounded-3xl p-4 shadow-2xl ${breath ? 'bg-neon-yellow text-ink-900' : 'bg-neon-pink text-white shadow-neon'}`}>
        <div className="flex items-start gap-3">
          <div className="wiggle text-4xl">{TAG_ICONS[cp.tag]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-snug">{caption}</p>
            <p className="mt-0.5 text-sm font-semibold opacity-90">
              {t(`tags.${cp.tag}`)} · {t('away', { d: formatDistance(distance) })}
              {more > 1 ? ` · +${more - 1} more nearby` : ''}
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-1 grid h-10 w-10 place-items-center rounded-full text-xl opacity-80" aria-label="Dismiss">✕</button>
        </div>

        {breath && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="https://m.uber.com/ul/?action=setPickup&pickup=my_location" target="_blank" rel="noreferrer"
              className="grid h-11 place-items-center rounded-xl bg-ink-900 font-bold text-white">🚕 Book Uber</a>
            <a href="https://book.olacabs.com/" target="_blank" rel="noreferrer"
              className="grid h-11 place-items-center rounded-xl bg-ink-900 font-bold text-white">🛺 Book Ola</a>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onView(cp)} className="h-11 rounded-xl bg-black/20 font-semibold">👀 View pin</button>
          <button onClick={() => onShare(cp, caption)} className="h-11 rounded-xl bg-black/20 font-semibold">📤 Share</button>
        </div>
      </div>
    </div>
  )
}
