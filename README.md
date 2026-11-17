# Fablenook

A cozy multiplayer fairy-tale study world in 3D. Pick an avatar, explore five realms in third person, and study together with shared focus timers. Three.js + Supabase Realtime, served as plain static files (GitHub Pages works, no build step).

## The five realms

| Realm | What it is | Study Circle |
|---|---|---|
| Skyfield | floating islands at four heights, rainbow bridges, cloud steps | Sky Gazebo, up the stairs |
| Coral Lagoon | underwater: caustic light, kelp, jellyfish, a reef terrace of shell homes | Pearl Study Grotto, centre |
| Hollyhollow | snowy night village under an aurora, cottages, Lantern Hill | Fireplace Library, walk in at the north end |
| Moonlit Pavilion | a lake at night, a glowing dance pavilion, lily-pad stones | Reading Terrace, across the second bridge |
| Petalwood | flower-house forest, a mushroom spiral up to the Canopy Deck | Blossom Study Circle, centre |

Travel by walking through a glowing gate (each realm has four, near where you arrive) or with the ✦ map button, which also shows how many people are in each realm and how many are studying.

## HUD buttons (top right)

| Button | What it does |
|---|---|
| ✦ Map | every realm, who is there, one-tap travel |
| 💃 Actions | Stand, Sit (anywhere), Dance, Wave, Spin, Cheer. Everyone in the realm sees them. Moving cancels an action; Wave, Spin and Cheer end by themselves |
| 📸 Snapshot | a framed picture of the game view with the realm's name and date. Name tags are optional. Desktop: Download PNG or Copy image. Phone: Share (the phone's share sheet) or Save |
| ⚙️ Menu | ❓ Guide (How to move, Study Circles and solo timer, Travelling, Actions and snapshots, Report an issue) · ♪ Music on / off · 🔇 Mute all sound (remembered on this device; a small 🔇 badge sits on ⚙️ while muted) |

On phones the four buttons stack under the minutes pill; in landscape they share the top line. Every button's hit area is at least 44 × 44 px, and hover / press effects never move it. Clicking or tapping outside any popup, or pressing Esc, closes it; that press does not walk or turn the camera. A half-written issue report asks "Discard your message?" first.

A small controls hint appears on the first visit only.

## Files

```
index.html            title screen, character select, HUD panels, import map for Three.js
style.css             jelly Y2K UI, floating labels, prompt, joystick, world map
config.js             Supabase URL + publishable key, Web3Forms key for issue reports
js/core.js            tiny shared helpers + the list of zone ids
js/net.js             Supabase Realtime wrapper (falls back to solo mode)
js/study.js           solo timer, shared circle timer, minutes ledger
js/audio.js           synthesised sound effects + optional music, mute-all
js3d/toon.js          style kit: cel shading, ink outlines, holo material, glows, instancing helper
js3d/surfaces.js      animated materials: caustic sand, moonlit water, swaying kelp
js3d/character.js     procedural chibi avatars and pets: idle, walk, run, sit, dance, wave, spin, cheer
js3d/kit.js           the zone building kit: ground, stairs, ramps, bridges, props, gates, NPCs, collision
js3d/env.js           sky dome, aurora, clouds, pegasi, sparkles, weather (snow, bubbles, petals, fireflies)
js3d/zones/*.js       one file per realm, built with the kit
js3d/controls.js      keyboard / mouse / touch input, follow camera, movement + collision
js3d/main.js          game loop, travel, multiplayer sync, labels, interactions, study UI,
                      actions, guide, issue report, snapshot, first-visit hint
```

## Run it locally

ES modules need a web server, so double-clicking `index.html` does not work:

```bash
cd fablenook
python3 -m http.server 8000
# open http://localhost:8000
```

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk | hold the left mouse button on the ground: you walk toward the cursor and follow it as it moves; let go to stop. WASD / arrow keys work too (Shift = walk slowly) | press and hold the ground: you walk toward your finger. Or the joystick under your left thumb |
| Walk to a spot | quick click on the ground | quick tap on the ground |
| Look around | right-drag, or two-finger drag on a Mac trackpad | drag with a second finger, or drag on empty sky |
| Zoom | scroll wheel, or pinch on a trackpad | pinch with two fingers, anywhere |
| Interact | E | tap the prompt button |
| Actions | keys 1–6 (Stand, Sit, Dance, Wave, Spin, Cheer), or 💃 | 💃 |
| Travel | walk into a gate, or the ✦ map | same |

Keys or the joystick override a held mouse button or finger. On a phone, two fingers that slide toward or away from each other zoom; anything else with a second finger looks around while you keep walking. Add `?low` to the URL to force low-quality mode, `?high` to stop the game switching to it on its own.

## Setup

1. **Supabase (free).** https://supabase.com → New project → Settings → API Keys. Copy the Project URL and the **publishable** key (`sb_publishable_...`) into `config.js`. No tables, SQL or auth are needed. Never put the secret / `service_role` key in this file.
2. **Issue reports (free).** Go to https://web3forms.com, enter **hello@yasmine.page** and create an access key; it arrives in that inbox. Paste it into `config.js`:
   ```js
   WEB3FORMS_KEY: "your-key-here",
   ```
   Reports from the ❓ Guide → Report an issue tab are then emailed to that inbox, with the realm, browser and screen size attached. Until a key is pasted, the Send button opens the visitor's own email app addressed to hello@yasmine.page instead. The key is a public form key, safe in a public repo.
3. **GitHub Pages.** Push the folder to a public repo, then Settings → Pages → Deploy from a branch → `main` / root.

## How it works

**Multiplayer.** Presence carries the slow facts (name, avatar, realm, study status, minutes). Broadcast carries position, facing and animation about 10 times a second while you move. You only see, and only interpolate, players in your own realm; the map counts everyone.

**Collision, without a physics engine.** Walkable shapes are registered with `K.solid()`. To move, the game looks straight down through every solid and keeps the highest surface within step height of your feet. No surface there (an edge), or a solid overlapping your body (a wall, a cliff), blocks the move. Stairs, ramps and bridges are just solids. Things you walk around are push-out shapes (`K.wall`, `K.post`, `K.boundary`).

**Hold-to-walk and click-to-move.** While a mouse button or finger is held on the ground, a ray from it finds the ground every frame and the character walks toward that point. A quick click or tap walks to the spot: if it makes no progress it sidesteps one way, then the other, then gives up. It does not plan routes, so aim at the stairs first, then the top.

**Sitting and actions.** Sitting puts the character on top of the cushion or mushroom seat (each seat stores its top height). Actions travel as an animation number in the same position messages and presence data the game already sends, so they need no extra network traffic and late joiners see them too.

**Snapshots** re-render one frame and copy it into a 2D canvas with a holo frame and caption, so nothing extra runs while you play.

**Study Circles.** One shared timer per realm. A session is only `{ start time, length }`, so every client derives the same countdown, and late joiners read it from presence. Step inside to join, stand still to sit on a free seat. You earn minutes only while you are inside during a focus round. A solo session keeps you out of the shared timer.

**Performance.** Each realm is built the first time someone enters it. Repeated props are instanced, shadows are blob discs, weather is one point cloud animated in a shader, pixel ratio is capped at 1.75, and there are no shadow maps or post-processing. If frames stay slow for about two seconds the game drops once to low quality: pixel ratio 1, no outlines, sparkles or drifting creatures, half the weather, shorter fog.

## Building a new realm

Copy a file in `js3d/zones/`, register it in `ZONES` (`js3d/kit.js`), `BUILD` (`js3d/main.js`) and `FN.ZONES` (`js/core.js`). Inside `build()`:

```js
const K = makeKit('myzone', 123);
K.floor(0, 0, 0, 36, toon('#bff0b4'));            // or K.island(...)
K.mesa(10, 0, 0, 5, 1.5); K.stairs(3, 0, 0, Math.PI / 2, 5, { landing: 1 });
K.setCircle({ name: 'My Circle', x: 0, z: -6, y: 0, r: 3.8, seats: K.seats(0, 0, -6, 2.6, 6), label: V(0, 4, -6) });
K.gates(0, 0, 26.5, Math.PI);                     // portals to every other realm
K.npc('Name', K.person('fairy', 2, 0), V(3, 0, 3), 2, ['Hello!']);
return K.finish({ spawn: V(0, 0, 17), env: { /* sky, fog, lights, weather: see env.js */ } });
```

## Credits

- [Three.js](https://threejs.org) (MIT) and the [Supabase JS client](https://github.com/supabase/supabase-js) (MIT), loaded from jsDelivr.
- Fonts: Bagel Fat One, Fredoka, Nunito (SIL Open Font License), from Google Fonts.
- No third-party 3D models, textures or audio. Every character, prop, texture and sound is generated in code.

## Limits worth knowing

- Timers trust each device's clock.
- The daily circle totals live in visitors' browsers and are gossiped between them; add a table if you want them permanent.
- Everyone shares one Realtime channel, comfortable for a few dozen visitors.
- No login, so names and minutes are honour-system.
- Collision is centre-point based, pets and NPCs do not block you, and the camera is stopped by ground, cliffs, walls and roofs but not by trees, columns or rails.
