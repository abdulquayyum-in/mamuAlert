import Sheet from './Sheet'
import ProductHuntBadge from './ProductHuntBadge'
import { VIBE_LANGS } from '../lib/i18n'
import { SOUND_OPTIONS, playAlert, unlockAudio } from '../lib/sound'

function Row({ label, children }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">{label}</div>
      {children}
    </div>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
            value === o.id ? 'bg-neon-pink text-white shadow-neon' : 'bg-black/5 dark:bg-white/10'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsSheet({ open, onClose, settings, update, profile, onEditProfile, onEnableNotify, onReplayTour, demo, onSpawnDemo }) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings ⚙️">
      <button onClick={onEditProfile} className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-black/5 p-3 text-left dark:bg-white/5">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-neon-pink/20 text-2xl">{profile?.avatar}</span>
        <span className="flex-1">
          <span className="block font-bold">{profile?.username}</span>
          <span className="text-sm opacity-60">{profile?.points ?? 0} pts · tap to edit</span>
        </span>
        <span className="opacity-50">✏️</span>
      </button>

      <Row label="Theme">
        <Chips value={settings.theme} onChange={(theme) => update({ theme })}
          options={[{ id: 'dark', label: '🌚 Dark' }, { id: 'light', label: '🌞 Light' }]} />
      </Row>

      <Row label="Vibe Language">
        <Chips value={settings.lang} onChange={(lang) => update({ lang })} options={VIBE_LANGS} />
      </Row>

      <Row label="Alert sound / Voice pack">
        <Chips value={settings.sound} options={SOUND_OPTIONS}
          onChange={(sound) => { unlockAudio(); update({ sound }); playAlert(sound) }} />
      </Row>

      <Row label={`Alert radius · ${settings.radius} m`}>
        <input type="range" min={200} max={2000} step={100} value={settings.radius}
          onChange={(e) => update({ radius: Number(e.target.value) })} className="w-full accent-[#ff2e88]" aria-label="Alert radius" />
      </Row>

      <Row label="Background notifications">
        {settings.notify ? (
          <div className="flex items-center justify-between rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <span>🔔 On</span>
            <button onClick={() => update({ notify: false })} className="rounded-full bg-black/10 px-4 py-2 text-sm dark:bg-white/10">Turn off</button>
          </div>
        ) : (
          <button onClick={onEnableNotify} className="h-12 w-full rounded-2xl bg-neon-cyan font-bold text-ink-900">🔔 Enable notifications</button>
        )}
      </Row>

      <button onClick={onReplayTour} className="mb-5 h-12 w-full rounded-2xl bg-black/5 font-semibold dark:bg-white/10">
        🧭 Replay the app tour
      </button>

      {demo && (
        <Row label="Demo tools 🧪">
          <div className="space-y-2">
            <button onClick={onSpawnDemo} className="h-12 w-full rounded-2xl bg-black/5 font-semibold dark:bg-white/10">Spawn demo pins near me</button>
            <label className="flex min-h-[48px] items-center justify-between rounded-2xl bg-black/5 px-4 dark:bg-white/10">
              <span className="font-semibold">Walk mode: tap map to move “me”</span>
              <input type="checkbox" checked={settings.walkMode} onChange={(e) => update({ walkMode: e.target.checked })} className="h-5 w-5 accent-[#ff2e88]" />
            </label>
          </div>
        </Row>
      )}

      <div className="mb-4 flex flex-col items-center gap-2">
        <span className="text-xs font-semibold opacity-60">Enjoying NaakaAlert? Show some love 🧡</span>
        <ProductHuntBadge theme={settings.theme === 'light' ? 'light' : 'dark'} />
        <span className="mt-1 text-center text-xs font-semibold opacity-60">
          🛵 Made for fun, in free time · not affiliated with any police department
        </span>
      </div>

      <p className="pb-2 text-xs opacity-50">
        Your location stays on this device and is only used while the app is open. We never store your movement history.
      </p>
    </Sheet>
  )
}
