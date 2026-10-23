import { useEffect, useState } from 'react'

// Live position via watchPosition. Nothing is persisted or sent anywhere:
// location is only used in-memory while the app is open.
export function useGeolocation() {
  const [state, setState] = useState({ pos: null, accuracy: null, error: null, ready: false })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'unsupported', ready: true }))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setState({
        pos: { lat: p.coords.latitude, lng: p.coords.longitude },
        accuracy: p.coords.accuracy,
        error: null,
        ready: true,
      }),
      (err) => setState((s) => ({ ...s, error: err.code === 1 ? 'denied' : 'unavailable', ready: true })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return state
}
