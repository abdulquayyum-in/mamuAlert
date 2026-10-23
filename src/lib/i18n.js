// "Vibe Languages": every alert caption, button label, badge name and
// notification string switches with the selected vibe. Missing keys fall back
// to English Meme. Add Kannada etc. by adding another block to PACKS.

const en = {
  name: 'English Meme',
  dropPin: 'Drop a Pin 🚨',
  stillThere: 'Still there 👀',
  gone: 'Gone 💨',
  tags: {
    helmet: 'Helmet check', documents: 'Document check', breath: 'Breath analyzer',
    speed: 'Speed trap', diversion: 'Traffic diversion', general: 'General naaka',
  },
  vibe: ['Sus', 'Legit', '100% Fr Fr'],
  captions: [
    'Bro turn back 💀',
    'Naaka spotted, not a drill',
    'Your route said: nah',
    'Main character energy: take the side road',
    'Plot twist: cops ahead 👮',
    'This is your sign to slow down',
  ],
  breathCaptions: [
    'Breath check ahead. Had a drink? Cab it, king 🚕',
    'Sober? You\'re chilling. Not sober? Uber > U-turn',
    'Drinks + driving = flop era. Book a ride 🚕',
  ],
  badges: { ninja: 'Naaka Ninja', scout: 'Street Scout', nightOwl: 'Night Owl Reporter', legend: 'Verified Legend' },
  notifTitle: 'Naaka spotted 🚨',
  away: '{d} away',
  reported: 'Pin dropped! +10 pts 🫡',
  merged: 'Someone already spotted it — you confirmed it +5 👀',
  voted: 'Vote counted, thanks bestie',
}

const hi = {
  name: 'Hindi / Hinglish',
  dropPin: 'Naaka Spotted 🚨',
  stillThere: 'Abhi bhi hai 👀',
  gone: 'Nikal gaye 💨',
  tags: {
    helmet: 'Helmet check', documents: 'Kagaz check', breath: 'Breath analyzer',
    speed: 'Speed camera', diversion: 'Rasta band', general: 'Naaka hai bas',
  },
  vibe: ['Shady hai', 'Sahi hai', 'Pakka 100%'],
  captions: [
    'Bhai U-turn maar le 🙏',
    'Aage naaka hai, mood kharab mat kar',
    'Rasta badal, kismat badal',
    'Challan se bachna hai toh gali pakad',
    'Ye route nahi chalega boss 💀',
    'Mummy ne kaha tha helmet pehen ke jaana',
    'Aaj ka plan: side road, full josh',
  ],
  breathCaptions: [
    'Peeke chalana? Bilkul nahi. Cab book kar bhai 🚕',
    'Daaru + gaadi = big no. Cab le le, hero',
    'Breath check aage hai — sober hai toh chill, warna cab 🚕',
  ],
  badges: { ninja: 'Naaka Ninja', scout: 'Gali ka Scout', nightOwl: 'Raat ka Ullu', legend: 'Pakka Legend' },
  notifTitle: 'Bhai naaka hai aage 🚨',
  away: '{d} door',
  reported: 'Pin gaad diya! +10 pts 🫡',
  merged: 'Pehle se kisi ne daala tha — confirm ho gaya +5 👀',
  voted: 'Vote gaya, shukriya bhai',
}

const dakhni = {
  name: 'Hyderabadi (Dakhni)',
  dropPin: 'Naaka dikha re 🚨',
  stillThere: 'Abhi bhi khade 👀',
  gone: 'Chale gaye mamu 💨',
  tags: {
    helmet: 'Helmet check', documents: 'Kagzaat check', breath: 'Phoonk machine',
    speed: 'Speed camera', diversion: 'Rasta band hai', general: 'Naaka hai',
  },
  vibe: ['Golmaal', 'Sahi hai', 'Hau, pakka'],
  captions: [
    'Kya re mamu, aage naaka hai 😭',
    'Nakko jao udhar, baigan ho jaata',
    'Hau bhai, dusra rasta pakdo',
    'Ek dum khatarnaak scene hai aage',
    'Hallu hallu chalao, police khade',
    'Kaiku tension leta, side gali hai na',
    'Mamu, helmet kidhar hai tera?',
  ],
  breathCaptions: [
    'Mamu pee ke hai toh cab bulao, seedha 🚕',
    'Nakko chalao pee ke, auto pakdo mamu 🛺',
    'Phoonk machine aage hai — Irani chai piya toh chill, aur kuch piya toh cab',
  ],
  badges: { ninja: 'Gully ka Raja', scout: 'Charminar Scout', nightOwl: 'Naaka Nawab', legend: 'Full Hyderabadi Legend' },
  notifTitle: 'Mamu naaka hai aage 🚨',
  away: '{d} dur',
  reported: 'Pin daal diye! +10 pts 🫡',
  merged: 'Pehle se koi daale the — confirm hogaya +5 👀',
  voted: 'Vote hogaya, shukriya mamu',
}

export const PACKS = { en, hi, dakhni }
export const VIBE_LANGS = [
  { id: 'en', label: 'English Meme' },
  { id: 'hi', label: 'Hindi / Hinglish' },
  { id: 'dakhni', label: 'Hyderabadi (Dakhni)' },
  { id: 'mix', label: 'Mix (random)' },
]

// In Mix mode labels stay stable for the session; captions rotate across all packs.
const mixLabelLang = ['en', 'hi', 'dakhni'][Math.floor(Math.random() * 3)]

function lookup(pack, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), pack)
}

export function createT(lang) {
  const pack = PACKS[lang === 'mix' ? mixLabelLang : lang] || en
  return (key, vars) => {
    let v = lookup(pack, key)
    if (v === undefined) v = lookup(en, key)
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    return v
  }
}

let lastCaption = null
export function randomCaption(lang, tag) {
  const key = tag === 'breath' ? 'breathCaptions' : 'captions'
  const pool = lang === 'mix'
    ? Object.values(PACKS).flatMap((p) => p[key])
    : (PACKS[lang] || en)[key]
  const options = pool.length > 1 ? pool.filter((c) => c !== lastCaption) : pool
  lastCaption = options[Math.floor(Math.random() * options.length)]
  return lastCaption
}
