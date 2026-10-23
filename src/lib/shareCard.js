// Shareable 1080×1920 story card: map snippet + meme caption + local stickers.
import { TAG_ICONS } from './rules'

const W = 1080
const H = 1920
const MAP_TOP = 520
const MAP_SIZE = 1000
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function drawMap(c, lat, lng, z = 16) {
  const n = 2 ** z
  const fx = ((lng + 180) / 360) * n
  const latR = (lat * Math.PI) / 180
  const fy = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n
  const ox = (W - MAP_SIZE) / 2
  const cx = ox + MAP_SIZE / 2
  const cy = MAP_TOP + MAP_SIZE / 2
  const tx0 = Math.floor(fx - MAP_SIZE / 512) - 1
  const ty0 = Math.floor(fy - MAP_SIZE / 512) - 1
  const jobs = []
  for (let tx = tx0; tx <= tx0 + 5; tx++) {
    for (let ty = ty0; ty <= ty0 + 5; ty++) {
      const url = TILE_URL.replace('{z}', z).replace('{x}', ((tx % n) + n) % n).replace('{y}', ty).replace('{s}', 'a')
      jobs.push(loadImg(url).then((img) => ({ img, tx, ty })))
    }
  }
  const tiles = await Promise.all(jobs)

  c.save()
  roundRect(c, ox, MAP_TOP, MAP_SIZE, MAP_SIZE, 56)
  c.clip()
  c.fillStyle = '#171726'
  c.fillRect(ox, MAP_TOP, MAP_SIZE, MAP_SIZE)
  // fallback street grid if tiles are blocked
  c.strokeStyle = '#2a2a44'
  c.lineWidth = 10
  for (let i = 0; i < 8; i++) {
    c.beginPath(); c.moveTo(ox + i * 150, MAP_TOP); c.lineTo(ox + i * 150 - 200, MAP_TOP + MAP_SIZE); c.stroke()
    c.beginPath(); c.moveTo(ox, MAP_TOP + i * 140); c.lineTo(ox + MAP_SIZE, MAP_TOP + i * 140 + 120); c.stroke()
  }
  c.filter = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)'
  tiles.forEach(({ img, tx, ty }) => {
    if (img) c.drawImage(img, cx + (tx - fx) * 256, cy + (ty - fy) * 256, 256, 256)
  })
  c.filter = 'none'
  c.fillStyle = 'rgba(7,7,12,0.25)'
  c.fillRect(ox, MAP_TOP, MAP_SIZE, MAP_SIZE)
  c.restore()

  // neon frame
  c.strokeStyle = '#ff2e88'
  c.lineWidth = 8
  c.shadowColor = '#ff2e88'
  c.shadowBlur = 30
  roundRect(c, ox, MAP_TOP, MAP_SIZE, MAP_SIZE, 56)
  c.stroke()
  c.shadowBlur = 0
  return { cx, cy }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function drawPin(c, x, y, icon) {
  ;[180, 120, 70].forEach((r, i) => {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,46,136,${0.12 + i * 0.1})`; c.fill()
  })
  c.beginPath(); c.arc(x, y, 58, 0, Math.PI * 2)
  c.fillStyle = '#ff2e88'; c.shadowColor = '#ff2e88'; c.shadowBlur = 40; c.fill(); c.shadowBlur = 0
  c.font = '64px "Apple Color Emoji","Noto Color Emoji",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(icon, x, y + 4)
}

function wrap(c, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (c.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

// ── Original sticker illustrations (simple vector shapes) ──
function chai(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-0.15)
  // cutting-chai glass
  c.beginPath(); c.moveTo(-50, -70); c.lineTo(50, -70); c.lineTo(38, 70); c.lineTo(-38, 70); c.closePath()
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill()
  c.beginPath(); c.moveTo(-46, -30); c.lineTo(46, -30); c.lineTo(38, 70); c.lineTo(-38, 70); c.closePath()
  c.fillStyle = '#c8823a'; c.fill()
  c.strokeStyle = '#fff'; c.lineWidth = 5
  c.beginPath(); c.moveTo(-50, -70); c.lineTo(50, -70); c.lineTo(38, 70); c.lineTo(-38, 70); c.closePath(); c.stroke()
  // steam
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 6
  ;[-20, 10].forEach((dx) => { c.beginPath(); c.moveTo(dx, -85); c.bezierCurveTo(dx + 20, -105, dx - 20, -120, dx, -145); c.stroke() })
  c.restore()
}

function auto(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s)
  // body
  c.fillStyle = '#ffe14d'
  c.beginPath(); c.moveTo(-110, 20); c.quadraticCurveTo(-110, -90, -10, -90); c.lineTo(90, -90); c.lineTo(110, 20); c.closePath(); c.fill()
  c.fillStyle = '#1f8f4e'
  c.fillRect(-115, 10, 230, 40)
  // windshield + door
  c.fillStyle = '#9be7ff'
  c.beginPath(); c.moveTo(-95, 0); c.quadraticCurveTo(-95, -70, -30, -72); c.lineTo(-30, 0); c.closePath(); c.fill()
  c.fillStyle = '#111'; c.fillRect(0, -70, 70, 70)
  // wheels
  c.fillStyle = '#111'
  ;[-75, 80].forEach((wx) => { c.beginPath(); c.arc(wx, 55, 26, 0, Math.PI * 2); c.fill() })
  c.fillStyle = '#aaa'
  ;[-75, 80].forEach((wx) => { c.beginPath(); c.arc(wx, 55, 9, 0, Math.PI * 2); c.fill() })
  c.restore()
}

function biryani(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s)
  // handi
  c.fillStyle = '#b4532a'
  c.beginPath(); c.ellipse(0, 20, 95, 70, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#8a3b1b'; c.fillRect(-70, -45, 140, 22)
  // rice mound
  c.fillStyle = '#ffd36b'
  c.beginPath(); c.ellipse(0, -48, 66, 34, 0, Math.PI, 0); c.fill()
  c.fillStyle = '#fff3c4'
  for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(-48 + (i % 7) * 16, -58 + Math.floor(i / 7) * 14, 5, 2.5, 0.5, 0, Math.PI * 2); c.fill() }
  // leg piece
  c.fillStyle = '#7a3a12'; c.beginPath(); c.ellipse(28, -70, 20, 13, -0.6, 0, Math.PI * 2); c.fill()
  c.restore()
}

const STICKERS = { en: [auto, chai], hi: [chai, auto], dakhni: [biryani, chai], mix: [biryani, auto] }

export async function renderShareCard({ lat, lng, tag, caption, tagLabel, distanceText, lang = 'en', vibeLabel }) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')
  await document.fonts?.ready

  const bg = c.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#12051f'); bg.addColorStop(0.6, '#07070c'); bg.addColorStop(1, '#03140c')
  c.fillStyle = bg; c.fillRect(0, 0, W, H)

  // caption
  c.fillStyle = '#fff'
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'
  c.font = '700 84px "Space Grotesk","Noto Sans Devanagari",sans-serif'
  const lines = wrap(c, caption, W - 160).slice(0, 4)
  const startY = 160 + (4 - lines.length) * 45
  lines.forEach((ln, i) => c.fillText(ln, 80, startY + i * 96))

  const { cx, cy } = await drawMap(c, lat, lng)
  drawPin(c, cx, cy, TAG_ICONS[tag] || '🚨')

  // chip row
  c.textAlign = 'left'
  c.font = '600 46px "Space Grotesk",sans-serif'
  const chip = `${TAG_ICONS[tag] || '🚨'} ${tagLabel}${distanceText ? ` · ${distanceText}` : ''}`
  const cw = c.measureText(chip).width + 70
  c.fillStyle = '#39ff88'
  roundRect(c, 80, 1590, cw, 90, 45); c.fill()
  c.fillStyle = '#07070c'; c.textBaseline = 'middle'
  c.fillText(chip, 115, 1637)
  if (vibeLabel) {
    c.fillStyle = '#22e4ff'
    c.fillText(`Vibe: ${vibeLabel}`, 80, 1740)
  }

  const [s1, s2] = STICKERS[lang] || STICKERS.en
  s1(c, 900, 1700, 0.9)
  s2(c, 960, 430, 0.7)

  c.font = '600 36px "Space Grotesk",sans-serif'
  c.fillStyle = 'rgba(255,255,255,0.6)'
  c.textAlign = 'center'
  c.fillText('NaakaAlert · crowdsourced · ride safe, ride legal', W / 2, H - 70)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
}

export async function shareBlob(blob, text) {
  const file = new File([blob], 'naaka-alert.jpg', { type: 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'naaka-alert.jpg'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return 'downloaded'
}
