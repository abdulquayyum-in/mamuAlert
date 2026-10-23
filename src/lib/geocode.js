// Place search via Photon (OSM-based, supports type-ahead). Override with
// VITE_GEOCODER_URL to point at a self-hosted Photon for real traffic.
const GEOCODER_URL = import.meta.env.VITE_GEOCODER_URL || 'https://photon.komoot.io/api/'

function label(p) {
  const main = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.state
  const area = [p.name && p.street, p.district || p.locality, p.city, p.state]
    .filter((x) => x && x !== main)
  return { main, sub: [...new Set(area)].slice(0, 3).join(', ') }
}

export async function searchPlaces(query, { near, signal } = {}) {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'en' })
  // Bias results toward where the user is (without sending exact location: rounded to ~1 km).
  if (near) {
    params.set('lat', near.lat.toFixed(2))
    params.set('lon', near.lng.toFixed(2))
  }
  const res = await fetch(`${GEOCODER_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`geocoder ${res.status}`)
  const data = await res.json()
  return (data.features || []).map((f) => {
    const [lng, lat] = f.geometry.coordinates
    return { id: `${f.properties.osm_type}${f.properties.osm_id}`, lat, lng, ...label(f.properties) }
  })
}
