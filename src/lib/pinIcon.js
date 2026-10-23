import L from 'leaflet'
import { TAG_ICONS, lifeLeft, vibeLevel } from './rules'

const RING_R = 25
const CIRC = 2 * Math.PI * RING_R
const VIBE_COLORS = ['#ffe14d', '#22e4ff', '#39ff88']

// Checkpoint marker: emoji badge inside a countdown ring that shrinks and
// fades as the pin ages. `fresh` adds the drop-bounce animation.
export function checkpointIcon(cp, { fresh = false, selected = false, now = Date.now() } = {}) {
  const left = lifeLeft(cp, now)
  const opacity = (0.4 + 0.6 * left).toFixed(2)
  const color = VIBE_COLORS[vibeLevel(cp)]
  const dash = (CIRC * left).toFixed(1)
  const icon = TAG_ICONS[cp.tag] || '🚨'
  const html = `
    <div class="pin ${fresh ? 'pin-drop' : ''} ${selected ? 'pin-selected' : ''}" style="opacity:${opacity}">
      <svg viewBox="0 0 60 60" class="pin-ring">
        <circle cx="30" cy="30" r="${RING_R}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"/>
        <circle cx="30" cy="30" r="${RING_R}" fill="none" stroke="${color}" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="${dash} ${CIRC.toFixed(1)}" transform="rotate(-90 30 30)"/>
      </svg>
      <div class="pin-core">${icon}</div>
      ${cp.confirmations > 1 ? `<div class="pin-count">${cp.confirmations}</div>` : ''}
    </div>`
  return L.divIcon({ html, className: 'pin-wrap', iconSize: [60, 60], iconAnchor: [30, 30] })
}

export function userIcon(avatar) {
  return L.divIcon({
    html: `<div class="me"><div class="me-pulse"></div><div class="me-dot">${avatar || '😎'}</div></div>`,
    className: 'pin-wrap',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

// Temporary marker for a place picked from search, until the pin is dropped.
export const searchIcon = L.divIcon({
  html: '<div class="pin pin-drop"><div class="search-pin">📍</div></div>',
  className: 'pin-wrap',
  iconSize: [60, 60],
  iconAnchor: [30, 54],
})
