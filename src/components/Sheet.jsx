export default function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="sheet-enter relative w-full max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-black/5 bg-white px-4 pt-3 safe-bottom shadow-2xl dark:border-white/10 dark:bg-ink-800">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20" />
        {title && <h2 className="mb-3 text-xl font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
