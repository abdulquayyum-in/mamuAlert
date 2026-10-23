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

// Coarse region cells (must match public.naaka_region() in SQL).
export const REGION_DEG = 0.25

export function regionOf({ lat, lng }) {
  return `r${Math.floor(lat / REGION_DEG)}_${Math.floor(lng / REGION_DEG)}`
}

// The 3×3 block of cells around a point (~80 km across at Indian latitudes).
export function regionsAround({ lat, lng }) {
  const i = Math.floor(lat / REGION_DEG)
  const j = Math.floor(lng / REGION_DEG)
  const out = []
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) out.push(`r${i + di}_${j + dj}`)
  return out
}

export function regionsAroundCell(cell) {
  const [, i, j] = cell.match(/^r(-?\d+)_(-?\d+)$/)
  return regionsAround({ lat: (Number(i) + 0.5) * REGION_DEG, lng: (Number(j) + 0.5) * REGION_DEG })
}
