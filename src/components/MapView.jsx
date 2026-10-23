import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { checkpointIcon, searchIcon, userIcon } from '../lib/pinIcon'

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const FALLBACK_CENTER = [17.385, 78.4867] // Hyderabad

function Events({ onLongPress, onTap }) {
  useMapEvents({
    // Leaflet fires contextmenu for right-click and touch long-press.
    contextmenu: (e) => onLongPress({ lat: e.latlng.lat, lng: e.latlng.lng }),
    click: (e) => onTap?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

function Follow({ pos, recenterKey }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (!pos) return
    if (first.current) {
      map.setView([pos.lat, pos.lng], 16)
      first.current = false
    }
  }, [pos, map])
  useEffect(() => {
    if (recenterKey && pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [recenterKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const zoom = Math.max(map.getZoom(), target.zoom || 15)
    let center = L.latLng(target.lat, target.lng)
    // Keep the target visible above a bottom sheet: shift the view so it sits high on screen.
    if (target.raise) {
      const shifted = map.project(center, zoom).add([0, map.getSize().y * target.raise])
      center = map.unproject(shifted, zoom)
    }
    map.flyTo(center, zoom, { duration: 0.8 })
  }, [target, map])
  return null
}

function CheckpointMarker({ cp, selected, onSelect, now }) {
  // Animate the drop only for pins that appeared after the map loaded.
  const [fresh] = useState(() => Date.now() - new Date(cp.created_at).getTime() < 20000)
  const icon = useMemo(
    () => checkpointIcon(cp, { fresh, selected, now }),
    [cp, fresh, selected, now],
  )
  return <Marker position={[cp.lat, cp.lng]} icon={icon} eventHandlers={{ click: () => onSelect(cp) }} />
}

export default function MapView({ pos, accuracy, avatar, checkpoints, selectedId, onSelect, onLongPress, onTap, recenterKey, flyTarget, searchPin, onSearchPinMove, radius }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  const me = useMemo(() => userIcon(avatar), [avatar])

  return (
    <MapContainer
      center={pos ? [pos.lat, pos.lng] : FALLBACK_CENTER}
      zoom={pos ? 16 : 13}
      zoomControl={false}
      className="absolute inset-0 z-0"
      preferCanvas
    >
      <TileLayer url={TILE_URL} maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <Events onLongPress={onLongPress} onTap={onTap} />
      <Follow pos={pos} recenterKey={recenterKey} />
      <FlyTo target={flyTarget} />
      {pos && (
        <>
          <Circle center={[pos.lat, pos.lng]} radius={radius} pathOptions={{ color: '#22e4ff', weight: 1, opacity: 0.35, fillOpacity: 0.04, dashArray: '4 6' }} />
          {accuracy && accuracy < 200 && (
            <Circle center={[pos.lat, pos.lng]} radius={accuracy} pathOptions={{ color: '#22e4ff', weight: 0, fillOpacity: 0.12 }} />
          )}
          <Marker position={[pos.lat, pos.lng]} icon={me} zIndexOffset={1000} interactive={false} />
        </>
      )}
      {searchPin && (
        <Marker
          position={[searchPin.lat, searchPin.lng]}
          icon={searchIcon}
          zIndexOffset={900}
          draggable
          eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onSearchPinMove?.({ lat: ll.lat, lng: ll.lng }) } }}
        />
      )}
      {checkpoints.map((cp) => (
        <CheckpointMarker key={cp.id} cp={cp} selected={cp.id === selectedId} onSelect={onSelect} now={now} />
      ))}
    </MapContainer>
  )
}
