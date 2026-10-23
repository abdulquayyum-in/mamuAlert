import { useCallback, useEffect, useState } from 'react'
import { load, save } from '../lib/storage'
import { DEFAULT_ALERT_RADIUS_M } from '../lib/rules'

const KEY = 'naaka.settings'
const DEFAULTS = {
  theme: 'dark',
  lang: 'en',
  sound: 'meme',
  radius: DEFAULT_ALERT_RADIUS_M,
  notify: false,
  seenDriveReminder: false,
  walkMode: false,
}

export function useSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...load(KEY, {}) }))

  useEffect(() => {
    save(KEY, settings)
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', settings.theme === 'dark' ? '#07070c' : '#f6f5fb')
  }, [settings])

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  return [settings, update]
}
