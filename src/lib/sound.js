// Alert sounds. "beep" and "meme" are synthesised with WebAudio (original,
// no samples). Voice packs load /audio/{pack}/manifest.json; if a clip file is
// missing the line is spoken with the device's own TTS so packs work before
// real recordings are dropped in.

export const SOUND_OPTIONS = [
  { id: 'meme', label: 'Meme SFX' },
  { id: 'beep', label: 'Classic beep' },
  { id: 'hindi-bhai', label: 'Hindi Bhai (voice)' },
  { id: 'hyderabadi-mamu', label: 'Hyderabadi Mamu (voice)' },
  { id: 'silent', label: 'Silent' },
]

let ctx = null
function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Call from a user gesture once so iOS lets us play sound later.
export function unlockAudio() {
  audioCtx()
}

function tone(c, { freq, endFreq, start, dur, type = 'square', vol = 0.15 }) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + start + dur)
  g.gain.setValueAtTime(0.0001, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.05)
}

const SYNTHS = {
  beep(c) {
    tone(c, { freq: 880, start: 0, dur: 0.15, type: 'sine', vol: 0.25 })
    tone(c, { freq: 880, start: 0.25, dur: 0.15, type: 'sine', vol: 0.25 })
  },
  meme(c) {
    const pick = Math.floor(Math.random() * 3)
    if (pick === 0) {
      // airhorn-ish triple blast
      for (let i = 0; i < 3; i++) {
        tone(c, { freq: 466, start: i * 0.22, dur: 0.18, type: 'sawtooth', vol: 0.12 })
        tone(c, { freq: 587, start: i * 0.22, dur: 0.18, type: 'sawtooth', vol: 0.08 })
      }
    } else if (pick === 1) {
      // sad trombone slide "wah wah"
      ;[392, 370, 349, 330].forEach((f, i) => tone(c, { freq: f, endFreq: f * 0.94, start: i * 0.32, dur: 0.3, type: 'triangle', vol: 0.2 }))
    } else {
      // siren whoop
      tone(c, { freq: 500, endFreq: 1100, start: 0, dur: 0.35, type: 'sine', vol: 0.2 })
      tone(c, { freq: 1100, endFreq: 500, start: 0.35, dur: 0.35, type: 'sine', vol: 0.2 })
    }
  },
}

const manifests = {}
const lastClip = {}

async function loadPack(id) {
  if (!manifests[id]) {
    manifests[id] = fetch(`/audio/${id}/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  }
  return manifests[id]
}

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang || 'hi-IN'
  const voice = speechSynthesis.getVoices().find((v) => v.lang === u.lang)
  if (voice) u.voice = voice
  u.rate = 1.05
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

async function playVoice(id) {
  const pack = await loadPack(id)
  if (!pack?.clips?.length) return SYNTHS.beep(audioCtx())
  // Never the same clip twice in a row.
  const options = pack.clips.length > 1 ? pack.clips.filter((c) => c.file !== lastClip[id]) : pack.clips
  const clip = options[Math.floor(Math.random() * options.length)]
  lastClip[id] = clip.file
  try {
    const a = new Audio(`/audio/${id}/${clip.file}`)
    await a.play()
  } catch {
    speak(clip.text, pack.lang)
  }
}

export async function playAlert(soundId, { tag } = {}) {
  if (soundId === 'silent') return
  const c = audioCtx()
  if (soundId === 'beep' || soundId === 'meme') return c && SYNTHS[soundId](c)
  // Breath-analyzer alerts never play "take the side road" voice lines.
  if (tag === 'breath') return c && SYNTHS.beep(c)
  return playVoice(soundId)
}

export function vibrate(pattern = [200, 100, 200, 100, 300]) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
