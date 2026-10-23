# NaakaAlert 🚨

Crowdsourced, real-time naaka (police checkpoint) alerts for commuters. It's mobile-first, installable as a PWA, and dark mode with neon accents is the default.

**Stack:** React 18 + Vite + Tailwind 3, Leaflet/OpenStreetMap, Supabase (Postgres + PostGIS, Realtime, anonymous Auth, pg_cron / Edge Functions).

---

## Quick start (zero setup: offline demo mode)

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN IP for phones)
```

With no Supabase keys, the app runs in **demo mode**:

- Data lives in `localStorage`.
- Tabs sync with each other through `BroadcastChannel`.
- The same rules apply as on the server: the 5-minute rate limit, the 150 m merge, expiry, and 3 "gone" votes clearing a pin.
- **Settings → Demo tools** has two testing aids:
  - **Spawn demo pins** creates fake commuters' pins near you.
  - **Walk mode** lets you tap the map to move yourself and trigger proximity alerts.
- If location is blocked, demo mode drops you in central Hyderabad.

> Geolocation needs a secure context. `localhost` works. On a phone, use the **https** preview from Vercel/Netlify or a tunnel such as `npx localtunnel --port 5173`.

## Real-time mode (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → enable "Anonymous sign-ins".** Every device gets a stable user id with no PII. Phone OTP and Google can be linked to that id later (feature 9).
3. **Database → Extensions:** enable `postgis` and `pg_cron`. The migration also tries to enable them.
4. Run the SQL in order, either in the SQL editor or with `supabase db push` using the CLI:
   - `supabase/migrations/20261023000000_init.sql`: tables, PostGIS, RPCs, RLS, and the Realtime publication.
   - `supabase/migrations/20261023000100_cron.sql`: schedules `cleanup_checkpoints()` every minute.
   - `supabase/migrations/20261024000000_fix_self_merge.sql`: stops re-reports of your own pin from earning points.
   - `supabase/migrations/20261024010000_regions.sql`: adds the `region` column so clients only load and subscribe to nearby pins. **Run it before deploying any app version that uses regions.**
5. Copy `.env.example` to `.env` and fill in the keys, then run `npm run dev`.

### Expiry job: pg_cron vs. Edge Function

`cleanup_checkpoints()` does three things:

- Flips pins past `expires_at` to `expired`. Realtime pushes that change to all clients.
- About 10 minutes later, rolls them into the anonymised `checkpoint_heatmap` table.
- Deletes them.

Clients also hide a pin locally the second it expires, so nobody waits on the job.

If you'd rather not use pg_cron, skip `…0100_cron.sql` and deploy the Edge Function instead:

```bash
supabase functions deploy expire-checkpoints --no-verify-jwt
supabase secrets set CRON_SECRET=<random-string>
```

Then schedule it every minute (Dashboard → Integrations → Cron → HTTP request to the function URL), sending the header `x-cron-secret: <random-string>`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | for real-time | Project URL (Settings → API). Leave it blank for demo mode. |
| `VITE_SUPABASE_ANON_KEY` | for real-time | Anon/public key. It's safe in the browser because every write goes through RLS and security-definer RPCs. |
| `VITE_TILE_URL` | no | Tile template, default `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. It must send CORS headers or share cards fall back to a drawn grid. For real traffic, switch to a commercial tile provider (MapTiler, Stadia, Mapbox) per the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). |
| `VITE_GEOCODER_URL` | no | Place-search API (Photon format), default `https://photon.komoot.io/api/`. The public instance is fair-use only, so self-host [Photon](https://github.com/komoot/photon) for real traffic. Searches send the query plus your location rounded to about 1 km, to rank nearby results first. |
| `CRON_SECRET` (function secret) | if using the Edge Function | Shared secret checked by `expire-checkpoints`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | auto | Injected into Edge Functions by Supabase. Never put these in the frontend `.env`. |

## Deploy

**Vercel (current setup):** production is https://naaka-alert.vercel.app. The project is linked in `.vercel/`, and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are saved as Production env vars on Vercel. `.vercelignore` keeps your local `.env` from being uploaded. To ship an update:

```bash
npx vercel --prod
```

To set it up fresh elsewhere: import the repo, framework "Vite", add the `VITE_*` env vars, and deploy.

**Netlify:** use build command `npm run build` and publish directory `dist`.

Both serve over https, which geolocation, notifications, and PWA install need.

---

## What's implemented

| # | Feature | Status |
|---|---|---|
| 1 | Full-screen Leaflet map, pulsing avatar dot via `watchPosition`, all live pins | ✅ |
| 2 | Drop-a-pin (GPS) + long-press/right-click anywhere, 6 tags, 80-char note, emoji reaction, 5-min rate limit, 150 m merge → confirmation | ✅ client + server |
| 2b | Place search: type-ahead (Photon/OSM), results ranked near you with distances. Picking one flies the map there and shows a draggable 📍 to fine-tune, then "Drop pin here" opens the report sheet | ✅ |
| 3 | Proximity alerts: configurable radius (default 500 m), banner + vibration + sound, once per pin per user, system notification when the tab is backgrounded | ✅ (see "Background push" below) |
| 4 | 60 min expiry, +15 min per confirmation (max 2 h), shrinking/fading countdown ring, realtime removal, server cleanup job | ✅ |
| 5 | Supabase Realtime sync, with re-sync on reconnect and on tab focus | ✅ |
| 6 | "Still there 👀" / "Gone 💨", 3 gone votes clear the pin, vibe meter Sus → Legit → 100% Fr Fr | ✅ |
| 7 | Meme captions, meme SFX / beep / silent, shareable 1080×1920 story card (map snippet + caption) via Web Share or download | ✅ |
| 8 | Points (+10 report, +5 verify, −15 when your lone pin gets cleared as fake) and streak columns | ⚙️ server-side only; badges, leaderboard, and streak UI are follow-ups |
| 9 | Anonymous username + emoji avatar, real identity never shown | ✅ anon auth; phone OTP / Google linking is a follow-up |
| 10 | Route awareness (OSRM) | ⏭ follow-up |
| 11 | "Vibe Check" pre-ride checklist with confetti; breath-analyzer alerts suggest a cab (Uber/Ola links) | ✅ |
| 12 | Heatmap | ⚙️ anonymised `checkpoint_heatmap` aggregation is live; the map layer is a follow-up |
| 13–15 | Vibe Language: English Meme / Hinglish / Hyderabadi (Dakhni) / Mix for captions, buttons, tags, vibe meter, badge names, notifications | ✅ |
| 16 | Voice packs (Hindi Bhai, Hyderabadi Mamu) driven by `public/audio/{pack}/manifest.json`, never the same clip twice in a row | ✅ loader. **No audio files are shipped**: see below |
| 17 | Regional share cards with original vector stickers (chai glass, auto-rickshaw, biryani handi) and a Devanagari-capable font stack | ✅ (Devanagari-script captions are a follow-up) |
| UX | Dark default + light toggle, bottom sheets, 44–64 px tap targets, pin-drop bounce, first-time "don't use while driving" reminder, PWA manifest + service worker | ✅ |

### Voice packs: adding real clips

Every pack folder has a `manifest.json` listing `{ file, text }` clips. If an MP3/OGG file is missing, the app speaks `text` with the device's built-in TTS, so packs work today. To ship real audio:

1. Record original 2–4 s clips, or generate them with a TTS service whose licence allows redistribution. Keep each under 50 KB, e.g. `ffmpeg -i in.wav -ac 1 -b:a 48k out.mp3`.
2. Drop them into `public/audio/<pack>/` with the filenames from the manifest.
3. To add a new pack, create a folder + manifest and add it to `public/audio/manifest.json` and `SOUND_OPTIONS` in `src/lib/sound.js`.

Never use audio ripped from films, songs, or TV.

### Background push

When the app is open but backgrounded (another tab, or the screen is on with a different app in front on Android), alerts fire as system notifications through the service worker. Alerts when the app is fully closed need **server-sent Web Push**. That requires VAPID keys, a `push_subscriptions` table, and an Edge Function that fans out on checkpoint INSERT. It would also need the server to know users' rough location, which this MVP deliberately avoids. `public/sw.js` already handles `push` events, so only the server side is left.

## Product decisions worth knowing

- **Privacy:** location is used in memory only. The only coordinates stored are the pins people choose to drop. The heatmap is aggregated to roughly 110 m cells × hour-of-week, with no user ids.
- **Breath analyzer:** these alerts use safety-first captions ("cab it") with Uber/Ola buttons. Voice packs play a plain beep instead of "take the side gali" lines. The goal is getting people to not drink and drive, not helping them dodge the check.
- **Rate limit on merges too:** confirming via the report button counts as a report, so the button can't be spammed for points. Voting on a pin gives points only for the first vote.
- **Timezone:** streaks and heatmap buckets use `Asia/Kolkata`. Change it in the SQL if you launch elsewhere.

## Project layout

```
src/
  App.jsx                    screen state + flows
  components/                MapView, ReportSheet, PinSheet, AlertBanner, SettingsSheet, ProfileSetup, VibeCheck
  hooks/                     useGeolocation, useProximityAlerts, useSettings
  lib/backend/               supabase.js (real) · local.js (demo) · same interface
  lib/rules.js               expiry / merge / rate-limit constants (mirrored in SQL)
  lib/i18n.js                vibe-language packs
  lib/sound.js               WebAudio SFX + voice packs
  lib/shareCard.js           canvas story card
public/                      manifest, service worker, icons, audio packs
supabase/                    migrations + expire-checkpoints Edge Function
```
