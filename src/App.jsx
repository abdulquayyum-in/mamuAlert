import { useCallback, useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import ReportSheet from './components/ReportSheet'
import PinSheet from './components/PinSheet'
import AlertBanner from './components/AlertBanner'
import SettingsSheet from './components/SettingsSheet'
import ProfileSetup from './components/ProfileSetup'
import VibeCheck from './components/VibeCheck'
import Toast from './components/Toast'
import PlaceSearch from './components/PlaceSearch'
import { backend } from './lib/backend'
import { createT, randomCaption } from './lib/i18n'
import { distanceM, formatDistance } from './lib/geo'
import { vibeLevel } from './lib/rules'
import { playAlert, unlockAudio, vibrate } from './lib/sound'
import { renderShareCard, shareBlob } from './lib/shareCard'
import { useSettings } from './hooks/useSettings'
import { useGeolocation } from './hooks/useGeolocation'
import { useProximityAlerts } from './hooks/useProximityAlerts'

const DEMO = backend.mode === 'demo'
const DEMO_FALLBACK = { lat: 17.385, lng: 78.4867 }

function errorText(e) {
  switch (e?.code) {
    case 'rate_limited': {
      const m = Math.floor(e.waitSec / 60)
      const s = e.waitSec % 60
      return `Easy there 😅 one pin per 5 min. Try again in ${m ? `${m}m ` : ''}${s}s`
    }
    case 'checkpoint_inactive': return 'That pin already expired 💨'
    case 'note_too_long': return 'Note max 80 chars, keep it short'
    case 'profile_required': return 'Set up your profile first'
    default: return 'Something broke, try again 🙏'
  }
}

async function notify(title, body, tag) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const opts = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', vibrate: [200, 100, 200] }
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
  } catch { /* notifications unsupported */ }
}

export default function App() {
  const [settings, update] = useSettings()
  const t = useMemo(() => createT(settings.lang), [settings.lang])
  const geo = useGeolocation()
  const [fakePos, setFakePos] = useState(null)
  const pos = fakePos || geo.pos

  const [boot, setBoot] = useState({ loading: true, error: null })
  const [profile, setProfile] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [checkpoints, setCheckpoints] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [reportAt, setReportAt] = useState(null)
  const [alert, setAlert] = useState(null)
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [vibeOpen, setVibeOpen] = useState(false)
  const [recenterKey, setRecenterKey] = useState(0)
  const [flyTarget, setFlyTarget] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchPin, setSearchPin] = useState(null)

  const say = useCallback((text, kind) => setToast({ text, kind, id: Date.now() }), [])
  const refreshProfile = useCallback(() => backend.getProfile().then(setProfile).catch(() => {}), [])

  useEffect(() => {
    backend.init()
      .then(({ profile }) => { setProfile(profile); setBoot({ loading: false, error: null }) })
      .catch((error) => setBoot({ loading: false, error }))
  }, [])

  useEffect(() => {
    if (boot.loading || boot.error) return
    const unsub = backend.subscribeCheckpoints(setCheckpoints)
    backend.myVotes().then(setMyVotes)
    return unsub
  }, [boot])

  // Demo mode without GPS (desktop, denied permission): drop "me" in Hyderabad.
  useEffect(() => {
    if (DEMO && geo.error && !fakePos) setFakePos(DEMO_FALLBACK)
  }, [geo.error, fakePos])

  const selected = checkpoints.find((c) => c.id === selectedId) || null
  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null)
      say('That pin is gone now 💨')
    }
  }, [selectedId, selected, say])

  const onAlert = useCallback((cp, distance, more) => {
    const caption = randomCaption(settings.lang, cp.tag)
    setAlert({ cp, distance, caption, more, id: cp.id })
    vibrate()
    playAlert(settings.sound, { tag: cp.tag })
    backend.markSeen(cp.id).catch(() => {})
    if (document.visibilityState === 'hidden' && settings.notify && window.Notification?.permission === 'granted') {
      notify(t('notifTitle'), `${caption} · ${t(`tags.${cp.tag}`)} · ${t('away', { d: formatDistance(distance) })}`, cp.id)
    }
  }, [settings.lang, settings.sound, settings.notify, t])

  const { markSeen } = useProximityAlerts({
    pos, checkpoints, radius: settings.radius, enabled: !!profile, userId: profile?.id, onAlert,
  })

  const openReport = () => {
    unlockAudio()
    if (!pos) return say('Need your location to drop a pin 📍 — or long-press the map', 'error')
    setReportAt({ ...pos, source: 'gps' })
  }

  const submitReport = async ({ tag, note, emoji }) => {
    setBusy(true)
    try {
      const { merged, checkpoint } = await backend.report({ lat: reportAt.lat, lng: reportAt.lng, tag, note, emoji })
      markSeen(checkpoint.id)
      setMyVotes((v) => ({ ...v, [checkpoint.id]: 'still_there' }))
      say(merged ? t('merged') : t('reported'))
      update({ seenDriveReminder: true })
      setReportAt(null)
      setSearchPin(null)
      refreshProfile()
      return true
    } catch (e) {
      say(errorText(e), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const vote = async (id, type) => {
    setBusy(true)
    try {
      await backend.vote(id, type)
      setMyVotes((v) => ({ ...v, [id]: type }))
      say(t('voted'))
      refreshProfile()
    } catch (e) {
      say(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const share = async (cp, caption) => {
    say('Cooking your meme card… 🍳')
    try {
      const blob = await renderShareCard({
        lat: cp.lat,
        lng: cp.lng,
        tag: cp.tag,
        caption: caption || randomCaption(settings.lang, cp.tag),
        tagLabel: t(`tags.${cp.tag}`),
        distanceText: pos ? t('away', { d: formatDistance(distanceM(pos, cp)) }) : '',
        vibeLabel: t('vibe')[vibeLevel(cp)],
        lang: settings.lang,
      })
      const res = await shareBlob(blob, `${caption || t('notifTitle')} — via NaakaAlert`)
      if (res === 'downloaded') say('Card saved — post it on your story 📸')
    } catch {
      say('Could not make the card 😭', 'error')
    }
  }

  const enableNotify = async () => {
    if (!('Notification' in window)) return say('Notifications not supported on this browser', 'error')
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      update({ notify: true })
      say('Notifications on 🔔')
    } else say('Permission denied — enable it in browser settings', 'error')
  }

  if (boot.loading) {
    return <div className="grid h-full place-items-center text-2xl font-bold"><span className="animate-pulse">🚨 Loading the naakas…</span></div>
  }
  if (boot.error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-2xl font-bold">Couldn’t connect 😭</p>
          <p className="mt-2 opacity-70">Check your connection (and that Anonymous sign-ins are enabled in Supabase).</p>
          <button onClick={() => location.reload()} className="mt-4 h-12 rounded-2xl bg-neon-pink px-6 font-bold text-white">Retry</button>
        </div>
      </div>
    )
  }
  if (!profile || editingProfile) {
    return (
      <ProfileSetup
        demo={DEMO}
        initial={editingProfile ? profile : null}
        onCancel={editingProfile ? () => setEditingProfile(false) : null}
        onSave={async (p) => { setProfile(await backend.saveProfile(p)); setEditingProfile(false) }}
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView
        pos={pos}
        accuracy={fakePos ? null : geo.accuracy}
        avatar={profile.avatar}
        checkpoints={checkpoints}
        selectedId={selectedId}
        onSelect={(cp) => setSelectedId(cp.id)}
        onLongPress={(ll) => { unlockAudio(); setReportAt({ ...ll, source: 'map' }) }}
        onTap={DEMO && settings.walkMode ? setFakePos : undefined}
        recenterKey={recenterKey}
        flyTarget={flyTarget}
        searchPin={searchPin}
        onSearchPinMove={(ll) => setSearchPin((p) => ({ ...p, ...ll, moved: true }))}
        radius={settings.radius}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 px-3 safe-top">
        <button onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 shadow-lg backdrop-blur dark:bg-ink-800/90">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-neon-pink/20 text-xl">{profile.avatar}</span>
          <span className="text-left leading-tight">
            <span className="block max-w-[9rem] truncate text-sm font-bold">{profile.username}</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-neon-green">{profile.points} pts</span>
          </span>
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold shadow backdrop-blur dark:bg-ink-800/90">
            {checkpoints.length} live {DEMO && <span className="ml-1 text-neon-pink">DEMO</span>}
          </div>
          <button onClick={() => setSettingsOpen(true)} aria-label="Settings"
            className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-xl shadow-lg backdrop-blur dark:bg-ink-800/90">⚙️</button>
        </div>
      </div>

      <button onClick={() => setSearchOpen(true)}
        className="absolute inset-x-3 top-[calc(max(env(safe-area-inset-top),12px)+60px)] z-[500] flex h-12 items-center gap-2 rounded-full bg-white/90 px-4 text-left text-[15px] shadow-lg backdrop-blur dark:bg-ink-800/90">
        <span>🔍</span>
        <span className="opacity-60">Search a place to drop a pin</span>
      </button>

      {(geo.error || (DEMO && settings.walkMode)) && (
        <div className="absolute inset-x-3 top-[calc(max(env(safe-area-inset-top),12px)+118px)] z-[500] rounded-2xl bg-neon-yellow px-3 py-2 text-center text-sm font-semibold text-ink-900 shadow">
          {DEMO && settings.walkMode
            ? '🚶 Walk mode: tap the map to move yourself'
            : geo.error === 'denied'
              ? `📍 Location blocked — ${DEMO ? 'using a demo spot' : 'enable it to report & get alerts'}`
              : '📍 Can’t get your location right now'}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-[500] flex items-end justify-between gap-3 px-4 safe-bottom">
        <button onClick={() => setVibeOpen(true)} aria-label="Vibe check"
          className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-2xl shadow-lg backdrop-blur dark:bg-ink-800/90">🛡️</button>
        <div className={`relative flex-1 ${searchPin ? 'invisible' : ''}`}>
          {!settings.seenDriveReminder && !searchPin && (
            <div className="absolute -top-9 left-1/2 w-max -translate-x-1/2 rounded-full bg-neon-yellow px-3 py-1 text-xs font-bold text-ink-900 shadow">
              🛑 Don’t use while driving — pull over first
            </div>
          )}
          <button onClick={openReport}
            className="h-16 w-full rounded-full bg-neon-pink text-xl font-bold text-white shadow-neon transition active:scale-95">
            {t('dropPin')}
          </button>
        </div>
        <button onClick={() => setRecenterKey((k) => k + 1)} aria-label="Recenter"
          className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-2xl shadow-lg backdrop-blur dark:bg-ink-800/90">🎯</button>
      </div>

      {searchPin && (
        <div className="banner-enter absolute inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),16px)+80px)] z-[600] rounded-3xl bg-white p-3 shadow-2xl dark:bg-ink-800">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-neon-cyan/20 text-xl">📍</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{searchPin.moved ? `Near ${searchPin.main}` : searchPin.main}</p>
              <p className="truncate text-sm opacity-60">{searchPin.sub || 'Drag the marker to fine-tune'}</p>
            </div>
            <button onClick={() => setSearchPin(null)} aria-label="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg opacity-60">✕</button>
          </div>
          <p className="mt-1 px-1 text-xs opacity-50">Drag the 📍 to the exact spot if needed</p>
          <button
            onClick={() => setReportAt({ lat: searchPin.lat, lng: searchPin.lng, source: 'search', label: searchPin.moved ? `near ${searchPin.main}` : searchPin.main })}
            className="mt-2 h-14 w-full rounded-2xl bg-neon-pink text-lg font-bold text-white shadow-neon active:scale-[.98]"
          >
            Drop pin here 🚨
          </button>
        </div>
      )}

      {checkpoints.length === 0 && !searchPin && (
        <div className="pointer-events-none absolute inset-x-0 bottom-36 z-[400] text-center text-sm font-semibold opacity-80">
          <span className="rounded-full bg-white/90 px-3 py-1.5 shadow dark:bg-ink-800/90">
            No naakas nearby. Roads are clear… for now 😌
          </span>
        </div>
      )}

      <ReportSheet
        open={!!reportAt}
        at={reportAt}
        onClose={() => setReportAt(null)}
        onSubmit={submitReport}
        t={t}
        firstTime={!settings.seenDriveReminder}
        busy={busy}
      />
      <PinSheet
        cp={selected}
        onClose={() => setSelectedId(null)}
        t={t}
        pos={pos}
        myVote={selected ? myVotes[selected.id] : null}
        onVote={vote}
        onShare={(cp) => share(cp)}
        busy={busy}
        demo={DEMO}
        onFakeGone={(id) => backend.fakeGoneVotes(id)}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={update}
        profile={profile}
        onEditProfile={() => { setSettingsOpen(false); setEditingProfile(true) }}
        onEnableNotify={enableNotify}
        demo={DEMO}
        onSpawnDemo={() => {
          if (!pos) return say('Need a location first', 'error')
          backend.spawnDemo(pos)
          setSettingsOpen(false)
          say('Spawned some naakas around you 👮')
        }}
      />
      <VibeCheck open={vibeOpen} onClose={() => setVibeOpen(false)} />
      <AlertBanner
        alert={alert}
        t={t}
        onClose={() => setAlert(null)}
        onView={(cp) => { setAlert(null); setSelectedId(cp.id); setFlyTarget({ lat: cp.lat, lng: cp.lng, k: Date.now() }) }}
        onShare={(cp, caption) => share(cp, caption)}
      />
      <PlaceSearch
        open={searchOpen}
        near={pos}
        onClose={() => setSearchOpen(false)}
        onPick={(place) => {
          unlockAudio()
          setSearchOpen(false)
          setSearchPin(place)
          setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 17, raise: 0.1, k: Date.now() })
        }}
      />
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
