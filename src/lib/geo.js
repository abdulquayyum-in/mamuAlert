const R = 6371000

export function distanceM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
}

export function formatMinutes(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

// Random point within `radius` metres (for demo pins).
export function jitter({ lat, lng }, radius) {
  const r = radius * Math.sqrt(Math.random())
  const t = Math.random() * 2 * Math.PI
  return {
    lat: lat + (r * Math.cos(t)) / 111320,
    lng: lng + (r * Math.sin(t)) / (111320 * Math.cos((lat * Math.PI) / 180)),
  }
}
