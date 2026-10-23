import { useEffect } from 'react'

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, toast.ms || 3200)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-36 z-[1200] flex justify-center px-4">
      <div className={`banner-enter rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl ${
        toast.kind === 'error' ? 'bg-neon-yellow text-ink-900' : 'bg-ink-700 text-white dark:bg-white dark:text-ink-900'}`}>
        {toast.text}
      </div>
    </div>
  )
}
