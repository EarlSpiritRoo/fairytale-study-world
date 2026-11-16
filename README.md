# Fablenook

A cozy multiplayer fairy-tale study world. Pick an avatar, wander five magical zones, and study together with shared focus timers. Plain HTML + canvas + Supabase Realtime, so it runs from GitHub Pages with no build step and no server.

## Files

```
index.html         title screen, character select, HUD panels
style.css          jelly Y2K UI (tokens, .jelly, .btn, .chip, .pill)
config.js          Supabase URL + publishable key
js/world.js        helpers, the 5 zones, scenery drawing
js/fx.js           SHARED STYLE SYSTEM: theme tokens, holo/pearl/chrome fills, sparkles,
                   particle pool, parallax sky, butterflies, lens flare
js/characters.js   outlined chibi avatars, pets, NPCs
js/audio.js        synthesised sound effects + optional ambient music
js/net.js          Supabase Realtime wrapper (falls back to solo mode)
js/study.js        solo timer, shared circle timer, minutes ledger
js/main.js         game loop, camera, input, render pipeline, UI wiring
```

Try it right now: double-click `index.html`.

## Setup

### 1. Create the Supabase project (free)

1. Go to https://supabase.com, sign in, click **New project**. Any name, any region near you, any database password (you will not need it).
2. Wait for it to finish provisioning.
3. Open **Settings → API Keys** (or click **Connect** at the top of the project).
4. Copy two things:
   - **Project URL**, e.g. `https://abcdefgh.supabase.co`
   - **Publishable key**, starts with `sb_publishable_...`
     (older projects call this the `anon` key, a long `eyJ...` string; either works)

No tables, SQL or auth setup is needed. Fablenook only uses Realtime channels.

If players cannot see each other later, open **Realtime → Settings** in the dashboard and check that public access to channels is allowed.

### 2. Paste the keys

Open `config.js` and set the two values (already filled in for this project):

```js
SUPABASE_URL: "https://abcdefgh.supabase.co",
SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxx",
```

The publishable key is meant to be public, so committing it is fine. Never put the **secret** / `service_role` key in this file.

### 3. Push to GitHub

```bash
cd fablenook
git init
git add .
git commit -m "Fablenook"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fablenook.git
git push -u origin main
```

(Create the empty `fablenook` repository on github.com first. It must be public for Pages on a free account.)

### 4. Turn on GitHub Pages

1. Repository → **Settings → Pages**.
2. **Source**: Deploy from a branch. **Branch**: `main`, folder `/ (root)`. Save.
3. After a minute your world is live at `https://YOUR_USERNAME.github.io/fablenook/`.

Test multiplayer by opening the link in two tabs or on your phone.

## How it works

- **Presence** carries the slow facts about each visitor: name, avatar, zone, study status, total minutes.
- **Broadcast** carries positions (10 per second while moving), chat, emotes and circle events.
- **Study Circle timer**: a session is only `{ start time, length }`. Every client derives the same countdown from that, so there is nothing to keep in sync. Late joiners read running sessions from other players' presence. After the focus round comes a shared break (`BREAK_MINUTES` in `config.js`), then anyone can start the next round.
- **Minutes**: you earn circle minutes only while standing in the circle during a focus round. Solo sessions count wall-clock time, so they keep running in a background tab and survive a reload.
- **"Minutes focused here today"**: each browser keeps a small ledger of `zone → user → minutes` and gossips it to newcomers, merging by highest value per user. No database needed. The total resets at midnight in the timezone set by `DAY_TZ_OFFSET_HOURS`.
- **NPCs** follow a path computed from the clock, so everyone sees them in the same place with zero network traffic.

## Limits worth knowing

- Timers trust each device's clock. Phones and laptops sync theirs automatically, so drift is normally under a second.
- The daily ledger lives in visitors' browsers. If every visitor clears their storage on the same day, that day's circle total is lost. For permanent stats, add a Supabase table and write to it from `earn()` in `js/study.js`.
- Everyone shares one channel (`ROOM`). That is comfortable for a few dozen people; the Supabase free plan caps concurrent connections and messages per second. For bigger crowds, switch to one channel per zone in `js/net.js`.
- There is no login, so names and minutes are honour-system.

## The style system (how to restyle the other zones)

Skyfield is the reference zone. Everything it uses is opt-in data on the zone object in `js/world.js`, so another zone inherits the look by adding the same keys:

| Zone key | What it turns on |
|---|---|
| `sky: { day: [3 colours], sunset: [3 colours] }` | Parallax backdrop: gradient with a slow day→sunset cycle, sun, three cloud layers, far islands, flying pegasi, shooting stars, occasional rainbow. Give a night zone dark colours. |
| `pad: 260` | Paints the ground on a larger canvas so scenery can spill past the map edge, and lets the camera look out over it. |
| `ambient: { butterflies: 8, hearts: true }` | Butterflies plus drifting hearts and twinkles. |
| `particles: 'glitter'` | Screen-space ✦ glints (other options: `bubble`, `snow`, `petal`, `firefly`). |
| `groundFx(c, t)` | Animated ground-level extras drawn every frame (Skyfield: cloud waterfalls). |
| `blocks: [{x, y, r}]` | Areas the random scenery scatter must keep clear. |
| `circle.lift` | Floats the Study Circle plaque above the centrepiece instead of below the ring. |
| `night: 'rgba(...)'` | Night tint; glows are added on top of it. |

Already inherited by every zone with no changes: outlined avatars and pets, sparkle trails, eased camera, jelly name tags and timer bubbles, the jelly UI, vignette, sounds and music.

Building blocks for new scenery, all in `FN.FX` (`js/fx.js`):

- Fills: `FX.holo(c, x0, y0, x1, y1, shift)`, `FX.pearl(c, x, y, r)`, `FX.chrome(c, y0, y1)`
- Shapes: `FX.star` (✦), `FX.heart`, `FX.shadow` (soft contact shadow), `FX.gloss` (highlight), `FX.ink` (outline), `FX.jelly` (glossy plaque)
- Effects: `FX.emit(type, x, y, opts)`, `FX.burst(x, y, n)`, and `FN.glow` inside an `L.<type>` function for bloom
- Colours and fonts: `FN.THEME` (holo palette, ink, glow colours); the CSS twins are the variables at the top of `style.css`

Recipe for a prop: `FX.shadow` first, shapes filled with a material, `FX.ink` after each shape, one `FX.gloss`, optionally a ✦. To make it react when the player walks near, add its type to `FN.react` and use `d.near` (0 to 1) in its draw function.

Performance guards: particles are capped (150 world, 70 screen), the sky is painted at half resolution on alternate frames, the vignette is a CSS layer, and if frames stay slow for about two seconds the game drops to a low-quality mode once (no bloom or flare, 1x resolution, half the glitter, no UI shimmer).

## Extending

- **New zone**: add an entry to `ZONES` in `js/world.js` and its id to `ZONE_ORDER`. Portals are wired automatically. Visitors start in `START_ZONE` (`js/main.js`).
- **New scenery**: add a draw function to `D` (and a glow to `L` if it should shine at night), then place it in a zone's `build()`.
- **New avatar colours or pets**: `SCHEMES` and `PET_STYLE` in `js/characters.js`.
- **New emotes**: the `EMOTES` array in `js/main.js` plus a button in `index.html`.
