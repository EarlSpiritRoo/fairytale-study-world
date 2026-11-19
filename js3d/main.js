/* ============================================================
   main.js — boots the 3D world and glues everything together:
   screens, the local player, other players, labels,
   interactions, networking and the study UI.

   Sections:  1 setup · 2 actors · 3 screens · 4 update
              5 network · 6 labels · 7 study UI · 8 loop

   Untouched from the 2D version (plain scripts on window.FN):
   config.js, js/net.js (Supabase), js/study.js (timers + ledger),
   js/audio.js (sound).
   ============================================================ */
import * as THREE from 'three';
import { lerpAngle, ZONES, ZONE_ORDER } from './kit.js';
import { createEnv } from './env.js';
import { build as skyfield } from './zones/skyfield.js';
import { build as lagoon } from './zones/lagoon.js';
import { build as hollyhollow } from './zones/hollyhollow.js';
import { build as pavilion } from './zones/pavilion.js';
import { build as petalwood } from './zones/petalwood.js';
import { makeAvatar, makePet, KINDS, PETS, PET_LABEL, SCHEMES, SKINS, SIT_BASE } from './character.js';
import { Input, CameraRig, tryMove } from './controls.js';
import { blobTexture, holo, glow, outlines } from './toon.js';

const FN = window.FN, { Study, Net, Audio } = FN;
const $ = (id) => document.getElementById(id);
const EMOTES = ['👋', '✨', '💪', '☕'];
const START_ZONE = 'skyfield';
const BUILD = { skyfield, lagoon, hollyhollow, pavilion, petalwood };   // each realm is built the first time someone walks into it
const WALK = 2.6, RUN = 5.4;                            // metres per second
const SEND_MS = 100;                                    // position broadcast interval (~10 per second)
const ANIM = { idle: 0, walk: 1, run: 2, sit: 3, dance: 4, wave: 5, spin: 6, cheer: 7 };   // sent over the network as a number
const ACT = { 4: 'dance', 5: 'wave', 6: 'spin', 7: 'cheer' };

// ============================================================ 1. SETUP
const canvas = $('game');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' }); }
catch (e) { document.body.insertAdjacentHTML('beforeend', '<div class="fatal">Fablenook needs WebGL, and this browser could not start it.<br>Try another browser or turn on hardware acceleration.</div>'); throw e; }
const params = new URLSearchParams(location.search);
let lowQ = params.has('low'), autoQ = !params.has('low') && !params.has('high');       // ?low forces low quality, ?high locks high
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#dfeaff', 40, 210);
const camera = new THREE.PerspectiveCamera(55, 1, 0.25, 650);   // a tight near/far range keeps depth precise (less z-fighting)
const hemi = new THREE.HemisphereLight('#ffffff', '#d9c8ff', 1.5), sun = new THREE.DirectionalLight('#fff6e0', 1.7);
sun.position.set(30, 50, 20); scene.add(hemi, sun);

const env = createEnv(scene);
const built = {};                                       // zone id -> zone object (see kit.js finish())
let zone = null;                                        // the realm I am in
function getZone(id) {
  if (!built[id]) {
    const z = built[id] = BUILD[id](); z.group.visible = false; scene.add(z.group); z.setLow(lowQ);
    z.npcTags = z.npcs.map((n) => { const t = makeTag('npc'); setText(t, 'name', t.nm, n.name); return t; });
    z.portalTags = z.portals.map((p) => { const t = makeTag('gate'); setText(t, 'name', t.nm, '→ ' + ZONES[p.to].name); t.nm.style.color = ZONES[p.to].ui; return t; });
    applyOutlines();
  }
  return built[id];
}
const hideTags = (tags) => { for (const t of tags) { t.shown = false; t.el.style.display = 'none'; } };
// swap the visible realm (models, collision, sky, fog, weather); the caller places the player
function showZone(id) {
  if (zone) { zone.group.visible = false; hideTags(zone.npcTags); hideTags(zone.portalTags); for (const [it, t] of thingTags) if (it.zone === zone.id) hideTags([t]); }
  zone = getZone(id); zone.group.visible = true; env.apply(zone); rig.occluders = zone.occluders;
  $('zoneName').textContent = zone.name; document.title = 'Fablenook · ' + zone.name; Audio.setZone(zone.id, zone.sounds || []); document.documentElement.style.setProperty('--zone', ZONES[id].ui); document.body.dataset.zone = id;
  for (const k in others) showActor(others[k]);
}
const applyOutlines = () => { for (const o of outlines) o.visible = !lowQ; };
const input = new Input(canvas, $('joy'));
const rig = new CameraRig(camera, []);
let vw = 1, vh = 1, hudBottom = 0, viewShift = 0;

function resize() {
  vw = window.innerWidth; vh = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 1 : 1.75));       // capped: phones have very dense screens
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
  env.setScale(vh * 0.55 * renderer.getPixelRatio());
}
window.addEventListener('resize', resize);
function setLow(v) { lowQ = v; env.setLow(v); for (const k in built) built[k].setLow(v); applyOutlines(); document.body.classList.toggle('lowq', v); resize(); }

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const pick = (n) => Math.floor(Math.random() * n);
const rid = (n) => Math.random().toString(36).slice(2, 2 + n);
const FIRST = ['Rosalind', 'Elowen', 'Caspian', 'Marisol', 'Thistle', 'Lysander', 'Ondine', 'Briar', 'Isolde', 'Peregrine', 'Wren', 'Lucian', 'Coralie', 'Fenwick', 'Seraphine', 'Alaric', 'Juniper', 'Linnea', 'Evander', 'Clementine'];
const PLACES = ['Skyfield', 'Petalwood', 'Hollyhollow', 'the Lagoon', 'the Pavilion'];
const randomName = () => FIRST[pick(FIRST.length)] + ' of ' + PLACES[pick(PLACES.length)];

// ============================================================ 2. ACTORS (me and everyone else)
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#5a46a0', transparent: true, opacity: 0.28, depthWrite: false });
const blobGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
const lookKey = (l) => [l.kind, l.scheme, l.skin, l.pet].join('|');

// An actor = avatar + pet + blob shadows + a floating tag. dress() rebuilds the models when the look changes.
function makeActor(look) {
  const a = { pos: new THREE.Vector3(), vy: 0, lift: 0, rot: 0, anim: ANIM.idle, look: null, av: null, pet: null, petPos: new THREE.Vector3(), petRot: 0, tag: makeTag('') };
  dress(a, look); return a;
}
function dress(a, look) {
  if (a.look === lookKey(look)) return;
  if (a.av) { scene.remove(a.av.group); scene.remove(a.pet.group); }
  a.look = lookKey(look);
  a.av = makeAvatar(look); a.pet = makePet(look.pet);
  for (const [g, r] of [[a.av.group, 0.42], [a.pet.group, 0.26]]) { const b = new THREE.Mesh(blobGeo, blobMat); b.scale.setScalar(r); b.position.y = 0.04; b.userData.blob = true; g.add(b); }
  scene.add(a.av.group, a.pet.group);
  if (lowQ) applyOutlines();                                       // hide the new outlines too
}
// only draw people who are in my realm
function showActor(o) { const here = o.zone === zone.id; o.av.group.visible = o.pet.group.visible = here; if (!here) hideTags([o.tag]); }
function removeActor(a) { scene.remove(a.av.group); scene.remove(a.pet.group); a.tag.el.remove(); }
// place the models; the pet trots to a spot just behind its owner
// Visual height. The ground is made of steps, so the logical height jumps a whole step (0.3 m) at each edge;
// drawing that directly, or easing it quickly, pops the avatar and the camera up on every step.
// Instead the drawn height follows the AVERAGE ground over a 0.7 m window centred on the player (one tread
// deep), which turns any staircase into a smooth ramp in both directions, then two gentle smoothing stages.
// It never sinks more than 8 cm into the ground you are standing on (so ledges don't swallow your feet).
const HWIN = 0.7, HSAMPLES = 13;
function smoothHeight(a, dt, probe) {
  const mx = a.pos.x - (a.px ?? a.pos.x), mz = a.pos.z - (a.pz ?? a.pos.z), md = Math.hypot(mx, mz); a.px = a.pos.x; a.pz = a.pos.z;
  if (md > 1e-4) { a.hdx = mx / md; a.hdz = mz / md; }
  let target = a.pos.y;
  if (probe && md / Math.max(dt, 1e-3) > 0.3 && a.hdx !== undefined) {               // only the local player, only while walking
    let sum = 0;
    for (let i = 0; i < HSAMPLES; i++) {
      const o = (i / (HSAMPLES - 1) - 0.5) * HWIN, g = zone.ground(a.pos.x + a.hdx * o, a.pos.y, a.pos.z + a.hdz * o);
      sum += g !== null && Math.abs(g - a.pos.y) < 0.7 ? g : a.pos.y;
    }
    target = Math.max(sum / HSAMPLES, a.pos.y - 0.08);
  }
  if (a.vy1 === undefined || Math.abs(target - a.vy) > 1.6) { a.vy1 = a.vy = target; return; }   // first frame, teleports, realm changes
  const k = Math.min(1, dt * 20);
  a.vy1 += (target - a.vy1) * k; a.vy += (a.vy1 - a.vy) * k;
}
function poseActor(a, dt, probe = false) {
  smoothHeight(a, dt, probe);
  // sitting on a Study Circle seat: lift the whole avatar so it rests ON the cushion / stool, not in it
  let lift = 0;
  if (a.anim === ANIM.sit) for (const C of zone.circles) if (Math.abs(a.pos.y - C.y) < 1) for (const s of C.seats) if (Math.hypot(a.pos.x - s.x, a.pos.z - s.z) < 0.75) lift = s.top - a.pos.y - SIT_BASE;
  a.lift += (lift - a.lift) * Math.min(1, dt * 9);
  a.av.group.position.set(a.pos.x, a.vy + a.lift, a.pos.z); a.av.group.rotation.y = a.rot;
  a.av.update(dt, { move: a.anim === ANIM.walk ? 1 : a.anim === ANIM.run ? 2 : 0, sit: a.anim === ANIM.sit, act: ACT[a.anim] || null });
  const tx = a.pos.x - Math.sin(a.rot) * 0.85 + Math.cos(a.rot) * 0.5, tz = a.pos.z - Math.cos(a.rot) * 0.85 - Math.sin(a.rot) * 0.5;
  const dx = tx - a.petPos.x, dz = tz - a.petPos.z, d = Math.hypot(dx, dz);
  if (d > 12) a.petPos.set(tx, a.vy, tz);
  const moving = d > 0.25;
  if (moving) { const step = Math.min(d - 0.15, Math.min(d * 3.5, 7) * dt); a.petPos.x += dx / d * step; a.petPos.z += dz / d * step; a.petRot = lerpAngle(a.petRot, Math.atan2(dx, dz), dt * 10); }
  else a.petRot = lerpAngle(a.petRot, a.rot, dt * 4);
  a.petPos.y += (a.vy - a.petPos.y) * Math.min(1, dt * 8);
  a.pet.group.position.copy(a.petPos); a.pet.group.rotation.y = a.petRot;
  a.pet.update(dt, { move: moving ? 1 : 0 });
}

const randomLook = () => ({ kind: KINDS[pick(4)], scheme: pick(SCHEMES.length), skin: pick(SKINS.length), pet: PETS[pick(4)] });
const stored = load('fablenook.me') || {};
const me = Object.assign({ uid: 'u' + rid(10), name: randomName() }, randomLook(), stored);
me.key = me.uid + '-' + rid(4);                         // one presence key per TAB, so two tabs show up as two visitors
Study.me = me.uid;
let joined = false, onTitle = true;
const others = {};                                      // presence key -> remote actor
const saveProfile = () => save('fablenook.me', { uid: me.uid, name: me.name, kind: me.kind, scheme: me.scheme, skin: me.skin, pet: me.pet });

// ============================================================ 3. TITLE + CHARACTER SELECT
let actor = null;                                       // my own actor, created on entering
let preview = null;                                     // tiny second renderer for the live character preview
function startPreview() {
  const pr = new THREE.WebGLRenderer({ canvas: $('preview'), antialias: true, alpha: true });
  pr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); pr.setSize(200, 200, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  cam.position.set(0.3, 1.0, 3.5); cam.lookAt(0.3, 0.74, 0);
  sc.add(new THREE.HemisphereLight('#ffffff', '#d9c8ff', 1.5)); const d = new THREE.DirectionalLight('#fff6e0', 1.7); d.position.set(2, 4, 3); sc.add(d);
  preview = { pr, sc, cam, key: '', av: null, pet: null, holder: new THREE.Group() }; sc.add(preview.holder);
}
function renderPreview(dt, t) {
  const p = preview; if (!p) return;
  if (p.key !== lookKey(me)) {
    p.key = lookKey(me); p.holder.clear();
    p.av = makeAvatar(me); p.pet = makePet(me.pet, 1.25); p.pet.group.position.set(0.85, 0, 0.25); p.pet.group.rotation.y = -0.5;
    p.holder.add(p.av.group, p.pet.group);
  }
  p.av.group.rotation.y = Math.sin(t * 0.6) * 0.5; p.av.update(dt, { move: 0, sit: false }); p.pet.update(dt, { move: 0 });
  p.pr.render(p.sc, p.cam);
}
function buildPicker(el, items, get, set, render) {
  el.innerHTML = '';
  items.forEach((item, i) => {
    const b = document.createElement('button'); b.type = 'button'; render(b, item, i);
    b.onclick = () => { set(item, i); [...el.children].forEach((c, j) => c.classList.toggle('on', j === i)); Audio.sfx('pop'); };
    b.classList.toggle('on', get(item, i)); el.appendChild(b);
  });
}
function buildJoin() {
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  buildPicker($('pickKind'), KINDS, (k) => k === me.kind, (k) => { me.kind = k; }, (b, k) => { b.className = 'chip'; b.textContent = cap(k); });
  buildPicker($('pickScheme'), SCHEMES, (s, i) => i === me.scheme, (s, i) => { me.scheme = i; }, (b, s) => { b.className = 'swatch'; b.title = s.name; b.style.background = `linear-gradient(135deg, ${s.main} 55%, ${s.hair} 55%)`; });
  buildPicker($('pickSkin'), SKINS, (s, i) => i === me.skin, (s, i) => { me.skin = i; }, (b, s) => { b.className = 'swatch'; b.style.background = s; b.title = 'Skin tone'; });
  buildPicker($('pickPet'), PETS, (p) => p === me.pet, (p) => { me.pet = p; }, (b, p) => { b.className = 'chip'; b.textContent = PET_LABEL[p]; });
  $('nameInput').value = me.name;
}
$('rollName').onclick = () => { $('nameInput').value = randomName(); };
$('rollAll').onclick = () => { Object.assign(me, randomLook()); me.name = randomName(); buildJoin(); };
$('start').onclick = () => {
  Audio.unlock(); Audio.sfx('start');
  $('title').hidden = true; $('join').hidden = false; startPreview();
};
$('enter').onclick = () => {
  me.name = $('nameInput').value.trim().slice(0, 28) || randomName();
  saveProfile(); Audio.unlock(); Audio.sfx('portal');
  if (preview) { preview.pr.dispose(); preview = null; }
  actor = makeActor(me); actor.pos.copy(zone.spawn); actor.vy = actor.vy1 = actor.pos.y; actor.rot = zone.spawnYaw; actor.petPos.copy(actor.pos);
  actor.idle = 0; actor.seat = null; actor.trail = 0; actor.act = null; actor.forceSit = false; actor.noSit = false;
  rig.yaw = 0; rig.pitch = 0.3; rig.dist = rig.cur = 6.5; rig.first = true;
  joined = true; onTitle = false; input.enabled = true;
  if (document.activeElement) document.activeElement.blur(); canvas.focus({ preventScroll: true });   // keys work straight away
  $('join').hidden = true; $('hud').hidden = false;
  env.burst(actor.pos.clone().setY(1), 20);
  Net.connect(me.key); pushPresence(); uiTick(); maybeHint();
};
// ----- sound settings (⚙️ menu): Ambience on / off, two volume sliders, an optional calm pad -----
function showAudio() {
  for (const [btn, st, on] of [['ambBtn', 'ambState', Audio.ambienceOn], ['padBtn', 'padState', Audio.padOn]]) { $(btn).setAttribute('aria-pressed', on ? 'true' : 'false'); $(st).textContent = on ? 'on' : 'off'; }
  $('volAmb').value = Math.round(Audio.vol.ambience * 100); $('volFx').value = Math.round(Audio.vol.effects * 100);
}
$('ambBtn').onclick = () => { Audio.unlock(); Audio.setAmbience(!Audio.ambienceOn); showAudio(); };
$('padBtn').onclick = () => { Audio.unlock(); Audio.setPad(!Audio.padOn); showAudio(); };
$('volAmb').oninput = (e) => { Audio.unlock(); Audio.setVolume('ambience', e.target.value / 100); };
$('volFx').oninput = (e) => { Audio.unlock(); Audio.setVolume('effects', e.target.value / 100); Audio.sfx('click'); };
showAudio();
// ----- camera: Q / E quick 45-degree turns; the on-screen camera pad orbits (see controls.js) -----
input.onTurn = (d) => { if (joined) rig.turn(d); };
document.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('#pickKind,#pickScheme,#pickSkin,#pickPet,#start,#enter')) Audio.sfx('click'); });

// ============================================================ 4. UPDATE (my character)
// a realm can have several Study Circles (Skyfield: the Sky Gazebo and the Starlight Library)
const circleAt = (p) => zone.circles.find((C) => Math.hypot(p.x - C.x, p.z - C.z) < C.r && Math.abs(p.y - C.y) < 1) || null;
const inCircle = (p) => !!circleAt(p);

// ----- travel between realms -----
function travel(to) {
  if (!BUILD[to] || to === zone.id) return;
  $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 420);
  Audio.sfx('portal'); click = null; nearby = null; $('prompt').hidden = true; closePopups();
  Study.myCircle = null;
  showZone(to);
  const a = actor; a.pos.copy(zone.spawn); a.vy = a.vy1 = a.pos.y; a.rot = zone.spawnYaw; a.petPos.copy(a.pos); a.idle = 0; a.seat = null;
  rig.yaw = zone.spawnYaw + Math.PI; rig.pitch = 0.3; rig.cur = rig.dist; rig.first = true;
  for (let i = 0; i < 3; i++) env.burst(a.pos.clone().setY(a.pos.y + 0.5 + i * 0.5), 14);
  pushPresence(); sendPosition(true); uiTick();
}
let nearby = null;                                      // the interactable in reach, if any

// ----- click / tap to move -----
let click = null;                                       // { x, y, z, best, since, detour, side, tries }
const marker = new THREE.Group();
{ const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 20).rotateX(Math.PI / 2), holo()); const g = glow('#ffd6f5', 1.5, 0.7); g.position.y = 0.25; marker.add(ring, g); marker.visible = false; scene.add(marker); }
const tapRay = new THREE.Raycaster(), ndc = new THREE.Vector2();
// The standable spot under a screen point, or null. A click often lands on a step's riser or a kerb, so
// if the exact point fails we look a little further along the ray and a little higher (the top of that
// step); if it is a wall or cliff, we settle for the spot at its foot.
function groundAt(px, py) {
  ndc.set(px / vw * 2 - 1, -(py / vh) * 2 + 1); tapRay.setFromCamera(ndc, camera);
  const hit = tapRay.intersectObjects(zone.solids, false)[0]; if (!hit) return null;
  const d = tapRay.ray.direction, dl = Math.hypot(d.x, d.z) || 1; let gy = null, tx = hit.point.x, tz = hit.point.z;
  for (const [push, up] of [[0, 0.2], [0.35, 0.5], [0.35, 1.0], [0.8, 0.5], [0.8, 1.2]]) {
    tx = hit.point.x + d.x / dl * push; tz = hit.point.z + d.z / dl * push; gy = zone.ground(tx, hit.point.y + up, tz); if (gy !== null) break;
  }
  if (gy === null) { tx = hit.point.x - d.x / dl * 0.7; tz = hit.point.z - d.z / dl * 0.7; gy = zone.ground(tx, actor.pos.y + 0.2, tz); }
  return gy === null ? null : { x: tx, y: gy, z: tz };
}
const uiOpen = () => !$('studyModal').hidden || !$('guideModal').hidden || !$('snapModal').hidden;
let holdPt = null;                                      // where a held press is steering us
input.hitTest = (px, py) => joined && !uiOpen() && !!groundAt(px, py);
// quick click / tap: walk to that spot
input.onTap = (px, py) => {
  if (!joined || uiOpen()) return;
  const g = groundAt(px, py); if (!g) return;
  click = { x: g.x, y: g.y, z: g.z, best: 1e9, since: 0, detour: 0, side: 1, tries: 0 };
  marker.position.set(g.x, g.y + 0.08, g.z); marker.visible = true;
  env.burst(marker.position.clone().setY(g.y + 0.3), 6); Audio.sfx('click');
};
input.onAnyKey = () => { click = null; };

// ----- actions: Stand, Sit (anywhere), Dance, Wave, Spin, Cheer — keys 1 to 6. Moving cancels them. -----
const ACTIONS = ['stand', 'sit', 'dance', 'wave', 'spin', 'cheer'], ONE_SHOT = { wave: 2600, spin: 1660, cheer: 2300 };
function doAction(i) {
  const name = ACTIONS[i], a = actor; if (!joined || !name || uiOpen()) return;
  click = null; $('actionMenu').hidden = true;
  if (name === 'stand') { a.act = null; a.forceSit = false; a.noSit = true; a.seat = null; }
  else if (name === 'sit') { a.act = null; a.forceSit = true; a.noSit = false; }
  else { a.forceSit = false; a.seat = null; a.act = { code: ANIM[name], until: ONE_SHOT[name] ? performance.now() + ONE_SHOT[name] : Infinity }; }
  if (name === 'cheer' || name === 'spin') env.burst(a.pos.clone().setY(a.vy + 1.5), 16);
  Audio.sfx('pop'); sendPosition(true);
}
input.onAction = doAction;

function freeSeat(p) {                                  // nearest cushion nobody else is sitting on
  let best = null, bd = 1e9;
  for (const s of (circleAt(p) || zone.circle).seats) {
    let taken = false; for (const k in others) if (others[k].zone === zone.id && others[k].anim === ANIM.sit && Math.hypot(others[k].pos.x - s.x, others[k].pos.z - s.z) < 0.6) taken = true;
    const d = Math.hypot(p.x - s.x, p.z - s.z); if (!taken && d < bd) { bd = d; best = s; }
  }
  return best;
}
function updateMe(dt) {
  const a = actor, mv = input.move(), modal = uiOpen();
  if (input.hold.id === null) holdPt = null;
  let anim = ANIM.idle, heading = null;
  let dx = 0, dz = 0, run = false, go = false;
  if (mv.mag > 0.14 && !modal) {
    // keys / joystick: relative to the camera ("forward" is away from it). This always cancels a click-walk.
    const fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw), rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw);
    dx = fx * mv.z + rx * mv.x; dz = fz * mv.z + rz * mv.x; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    run = input.touchMove ? mv.mag > 0.8 : !input.walk; go = true; click = null;
  } else if (input.hold.id !== null && !modal) {
    // hold-to-walk: keep heading for whatever ground is under the cursor / finger, until it is released
    click = null; holdPt = groundAt(input.hold.x, input.hold.y) || holdPt;
    if (holdPt) {
      const d = Math.hypot(holdPt.x - a.pos.x, holdPt.z - a.pos.z);
      marker.position.set(holdPt.x, holdPt.y + 0.08, holdPt.z);
      if (d > 0.45) { dx = (holdPt.x - a.pos.x) / d; dz = (holdPt.z - a.pos.z) / d; run = d > 2.5; go = true; }
    }
  } else if (click) {
    // click-walk: head for the marker; if no progress for a moment, sidestep one way, then the other, then give up
    const c = click, d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
    if (d < 0.3 || c.tries > 6) click = null;
    else {
      let ang = Math.atan2(c.x - a.pos.x, c.z - a.pos.z);
      if (c.detour > 0) { c.detour -= dt; ang += c.side * 1.25; if (c.detour <= 0) { c.best = 1e9; c.since = 0; } }
      else if (d < c.best - 0.04) { c.best = d; c.since = 0; }
      else if ((c.since += dt) > 0.4) { c.tries++; c.side = -c.side; c.detour = 0.45 + c.tries * 0.2; }
      dx = Math.sin(ang); dz = Math.cos(ang); run = d > 2.5; go = true;
    }
  }
  marker.visible = !!click || !!holdPt; if (marker.visible) { marker.rotation.y += dt * 3; marker.scale.setScalar(1 + Math.sin(performance.now() / 150) * 0.12); }
  if (go) {
    const speed = run ? RUN : WALK;
    heading = Math.atan2(dx, dz);
    a.rot = lerpAngle(a.rot, heading, dt * 12);
    tryMove(a.pos, dx * speed * dt, dz * speed * dt, zone);
    anim = run ? ANIM.run : ANIM.walk; a.idle = 0; a.seat = null; a.act = null; a.forceSit = false; a.noSit = false;   // moving cancels any action
    if (run && (a.trail += dt) > 0.07) { a.trail = 0; env.trail(a.pos.clone().setY(a.vy + 0.15 + Math.random() * 0.4)); }
  } else a.idle += dt;

  // Study Circle: step into the gazebo to join the shared timer; stand still and you take a seat
  for (const p of zone.portals) if (Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < p.r && Math.abs(p.pos.y - a.pos.y) < 1.5) { travel(p.to); return null; }   // walked into a gate
  const C = circleAt(a.pos), inside = !!C, mine = inside && !Study.solo ? C.cid : null;
  if (mine !== Study.myCircle) { Study.myCircle = mine; pushPresence(); uiTick(); }
  if (a.act && performance.now() > a.act.until) a.act = null;                     // one-shot actions end by themselves
  if (go) { /* walking */ }
  else if (a.act) anim = a.act.code;
  else if (!a.noSit && (a.forceSit || (a.idle > 0.55 && (inside || Study.solo)))) {
    if (inside && !a.seat) a.seat = freeSeat(a.pos);
    if (inside && a.seat) { a.pos.x += (a.seat.x - a.pos.x) * Math.min(1, dt * 6); a.pos.z += (a.seat.z - a.pos.z) * Math.min(1, dt * 6); a.rot = lerpAngle(a.rot, Math.atan2(C.x - a.pos.x, C.z - a.pos.z), dt * 6); }
    anim = ANIM.sit;
  }
  a.anim = anim;
  poseActor(a, dt, true);

  // what can I interact with?
  let best = null, bd = 1e9;
  for (const it of zone.interactables) { const d = Math.hypot(it.pos.x - a.pos.x, it.pos.z - a.pos.z); if (d < it.r && Math.abs(it.pos.y - a.pos.y) < 2 && d < bd) { bd = d; best = it; } }
  if (best !== nearby) { nearby = best; $('prompt').hidden = !best; if (best) $('prompt').textContent = (matchMedia('(pointer: coarse)').matches ? 'Tap · ' : 'Press F · ') + best.label; }
  return heading;
}
function interact() {
  if (!joined || !nearby) return;
  const it = nearby, text = it.use(it);
  speak(it, text); Audio.sfx('pop');
  env.burst(new THREE.Vector3(it.pos.x, it.pos.y + (it.height || 1.5), it.pos.z), it.fx || 8);
}
input.onInteract = interact; $('prompt').onclick = interact;

// ============================================================ 5. NETWORK
const num = (v, a, b, d) => (isFinite(v) ? FN.clamp(+v, a, b) : d);
const r2 = (v) => Math.round(v * 100) / 100;
function myMeta() {
  const p = actor.pos;
  return {
    n: me.name, k: me.kind, sc: me.scheme, sk: me.skin, p: me.pet, z: zone.id,
    x: r2(p.x), y: r2(p.y), zz: r2(p.z), r: r2(actor.rot), a: actor.anim, tm: Study.total(),
    so: Study.solo ? { sub: Study.solo.subject, e: Study.solo.endsAt } : null,       // solo session
    ci: Study.myCircle,                                                              // circle I'm in
    cs: Study.circles,                                                               // sessions I know about (for late joiners)
  };
}
function pushPresence() { if (joined) Net.track(myMeta()); }

let lastSent = { x: 0, y: 0, z: 0, r: 0, a: -1, at: 0 };
function sendPosition(force) {
  if (!joined) return;
  const now = performance.now(), p = actor.pos;
  const changed = Math.abs(p.x - lastSent.x) + Math.abs(p.z - lastSent.z) + Math.abs(p.y - lastSent.y) > 0.01 || Math.abs(actor.rot - lastSent.r) > 0.05 || actor.anim !== lastSent.a;
  if (!force && now - lastSent.at < (changed ? SEND_MS : 3000)) return;               // idle = slow heartbeat
  lastSent = { x: p.x, y: p.y, z: p.z, r: actor.rot, a: actor.anim, at: now };
  Net.send('p', { i: me.key, n: zone.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), r: r2(actor.rot), a: actor.anim });
}

// Never trust data from the network: clamp and whitelist everything.
function cleanMeta(m) {
  return {
    name: String(m.n || 'Wanderer').slice(0, 28),
    kind: KINDS.includes(m.k) ? m.k : 'fairy', scheme: num(m.sc, 0, SCHEMES.length - 1, 0) | 0, skin: num(m.sk, 0, SKINS.length - 1, 0) | 0,
    pet: PETS.includes(m.p) ? m.p : 'kitten', zone: ZONES[m.z] ? m.z : START_ZONE,
    mx: num(m.x, -90, 90, 0), my: num(m.y, -20, 40, 0), mz: num(m.zz, -90, 90, 17), mr: num(m.r, -10, 10, 0), ma: num(m.a, 0, 7, 0) | 0,
    tm: num(m.tm, 0, 9999999, 0) | 0,
    so: m.so && isFinite(m.so.e) ? { sub: String(m.so.sub || '').slice(0, 24), e: +m.so.e } : null,
    ci: FN.CIRCLES[m.ci] ? m.ci : null,
  };
}
Net.on('presence', (state) => {
  let newcomer = false;
  for (const key in state) {
    if (key === me.key) continue;
    const raw = state[key] || {}, m = cleanMeta(raw);
    let o = others[key];
    if (!o) {
      newcomer = true; o = others[key] = makeActor(m);
      o.pos.set(m.mx, m.my, m.mz); o.vy = o.vy1 = m.my; o.rot = m.mr; o.anim = m.ma; o.petPos.copy(o.pos);
      o.tpos = o.pos.clone(); o.trot = m.mr; o.zone = m.zone;
    }
    if (o.zone !== m.zone) { o.zone = m.zone; o.pos.set(m.mx, m.my, m.mz); o.tpos.copy(o.pos); o.vy = o.vy1 = m.my; o.petPos.copy(o.pos); }   // they changed realm: snap
    dress(o, m); Object.assign(o, { name: m.name, tm: m.tm, so: m.so, ci: m.ci }); showActor(o);
    if (raw.cs && typeof raw.cs === 'object') for (const z in raw.cs) Study.mergeCircle(z, raw.cs[z]);
  }
  for (const key in others) if (!(key in state)) { removeActor(others[key]); delete others[key]; }
  if (newcomer) { Study.shareLedgerSoon(); sendPosition(true); }
  uiTick();
});
Net.on('msg:p', (p) => {
  const o = others[p.i]; if (!o || !ZONES[p.n]) return;
  if (o.zone !== p.n) { o.zone = p.n; o.pos.set(num(p.x, -90, 90, 0), num(p.y, -20, 40, 0), num(p.z, -90, 90, 0)); o.vy = o.vy1 = o.pos.y; o.petPos.copy(o.pos); showActor(o); }
  o.tpos.set(num(p.x, -90, 90, o.tpos.x), num(p.y, -20, 40, o.tpos.y), num(p.z, -90, 90, o.tpos.z));
  o.trot = num(p.r, -10, 10, o.trot); o.anim = num(p.a, 0, 7, 0) | 0;
});
Net.on('msg:c', (p) => { const o = others[p.i]; if (o && typeof p.m === 'string') say(o.tag, p.m.slice(0, 80)); });
Net.on('msg:e', (p) => { const o = others[p.i]; if (o && EMOTES[p.e]) { say(o.tag, EMOTES[p.e]); if (o.zone === zone.id) env.burst(o.pos.clone().setY(o.pos.y + 1.6), 6); } });
Net.on('msg:cs', (p) => { Study.mergeCircle(p.z, p.st); uiTick(); });
Net.on('msg:lc', (p) => Study.mergeLedger(p));
Net.on('msg:lg', (p) => Study.mergeLedger(p));
Net.on('status', (s) => {
  $('netStatus').textContent = { online: '', reconnecting: 'Reconnecting…', unconfigured: 'Solo mode — paste your Supabase keys into config.js to see friends', error: 'Solo mode — could not reach Supabase' }[s] || '';
  if (s === 'online') { pushPresence(); sendPosition(true); }
});
function updateOthers(dt) {
  const k = 1 - Math.exp(-dt * 10);
  for (const id in others) { const o = others[id]; if (o.zone !== zone.id) continue; o.pos.lerp(o.tpos, k); o.rot = lerpAngle(o.rot, o.trot, dt * 10); poseActor(o, dt); }
}

// ============================================================ 6. LABELS (DOM elements pinned to 3D points)
function makeTag(cls) {
  const el = document.createElement('div'); el.className = 'tag ' + cls;
  const sayEl = document.createElement('div'), stud = document.createElement('div'), nm = document.createElement('div');
  sayEl.className = 'say jelly'; stud.className = 'stud jelly'; nm.className = 'nm'; sayEl.hidden = stud.hidden = true;
  el.append(sayEl, stud, nm); $('labels').appendChild(el);
  return { el, sayEl, stud, nm, name: '', study: '', sayUntil: 0, shown: true };
}
const setText = (tag, key, el, text) => { if (tag[key] !== text) { tag[key] = text; el.textContent = text || ''; el.hidden = !text; } };
function say(tag, text) { tag.sayEl.textContent = text; tag.sayEl.classList.toggle('emote', text.length <= 2); tag.sayEl.hidden = false; tag.sayUntil = performance.now() + 5200; }
const proj = new THREE.Vector3();
// pin a tag above a world point; hides it when behind the camera or too far away
function placeTag(tag, x, y, z, maxDist) {
  proj.set(x, y, z); const dist = proj.distanceTo(camera.position); proj.project(camera);
  const show = proj.z < 1 && dist < maxDist && Math.abs(proj.x) < 1.2 && Math.abs(proj.y) < 1.3;
  if (show !== tag.shown) { tag.shown = show; tag.el.style.display = show ? '' : 'none'; }
  if (!show) return;
  if (tag.sayUntil && performance.now() > tag.sayUntil) { tag.sayUntil = 0; tag.sayEl.hidden = true; }
  const s = FN.clamp(9 / dist, 0.5, 1);
  tag.el.style.transform = `translate(${((proj.x * 0.5 + 0.5) * vw).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * vh).toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
}
function studyText(solo, circleId, now) {
  if (solo && solo.e > now) return '📖 Studying · ' + (solo.sub ? solo.sub + ' · ' : '') + FN.fmt(solo.e - now);
  if (circleId) { const ph = Study.phase(circleId, now); if (ph.name === 'focus') return '📖 Circle focus · ' + FN.fmt(ph.left); if (ph.name === 'break') return '☕ Break · ' + FN.fmt(ph.left); }
  return '';
}
const circleCount = (z = zone.id) => { let n = Study.myCircle === z ? 1 : 0; for (const k in others) if (others[k].ci === z) n++; return n; };
const thingTags = new Map();                             // speech bubbles for signposts, pools…
const plaques = {};
const plaqueFor = (cid) => plaques[cid] || (plaques[cid] = (() => { const el = document.createElement('div'); el.className = 'tag plaque jelly'; el.innerHTML = '<b></b><span></span><small></small>'; $('labels').appendChild(el); return { el, shown: true, sayUntil: 0, txt: '' }; })());
function speak(it, text) {
  if (it.npc) return say(zone.npcTags[zone.npcs.indexOf(it.npc)], text);
  let t = thingTags.get(it); if (!t) { t = makeTag('npc'); t.nm.hidden = true; thingTags.set(it, t); }
  say(t, text);
}
function updateLabels(now) {
  if (!joined) return;
  const tagName = (n, tm) => n + (tm ? '  ✦ ' + tm + 'm' : '');
  setText(actor.tag, 'name', actor.tag.nm, tagName(me.name, Study.total()));
  setText(actor.tag, 'study', actor.tag.stud, studyText(Study.solo && { sub: Study.solo.subject, e: Study.solo.endsAt }, Study.myCircle, now));
  placeTag(actor.tag, actor.pos.x, actor.vy + actor.lift + (actor.anim === ANIM.sit ? 1.3 : 1.72), actor.pos.z, 60);
  for (const id in others) {
    const o = others[id]; if (o.zone !== zone.id) continue;
    setText(o.tag, 'name', o.tag.nm, tagName(o.name, o.tm)); setText(o.tag, 'study', o.tag.stud, studyText(o.so, o.ci, now));
    placeTag(o.tag, o.pos.x, o.vy + o.lift + (o.anim === ANIM.sit ? 1.3 : 1.72), o.pos.z, 45);
  }
  zone.npcs.forEach((n, i) => placeTag(zone.npcTags[i], n.pos.x, n.pos.y + n.height + 0.25, n.pos.z, zone.npcTags[i].sayUntil ? 30 : 16));
  zone.portals.forEach((p, i) => placeTag(zone.portalTags[i], p.tag.x, p.tag.y, p.tag.z, 26));
  for (const [it, t] of thingTags) if (it.zone === zone.id) placeTag(t, it.tag.x, it.tag.y, it.tag.z, t.sayUntil ? 30 : 0);
  // each Study Circle's plaque (the panel replaces it once you are inside that circle)
  const mineNow = circleAt(actor.pos);
  for (const C of zone.circles) {
    const plaque = plaqueFor(C.cid), ph = Study.phase(C.cid, now), n = circleCount(C.cid), txt = C.cid + Study.zoneTotal(C.cid) + '|' + n + '|' + ph.name + '|' + (ph.left ? FN.fmt(ph.left) : '');
    if (plaque.txt !== txt) {
      plaque.txt = txt; const [b, s, sm] = plaque.el.children;
      b.textContent = C.name; s.textContent = '✨ ' + Study.zoneTotal(C.cid) + ' minutes focused here today';
      sm.textContent = n + ' studying here now' + (ph.name === 'focus' ? '  ·  ⏳ ' + FN.fmt(ph.left) : ph.name === 'break' ? '  ·  ☕ ' + FN.fmt(ph.left) : '');
    }
    placeTag(plaque, C.label.x, C.label.y, C.label.z, mineNow === C ? 0 : C.labelDist || 70);   // indoor circles: only nearby (labels draw through walls)
  }
  for (const cid in plaques) if (!zone.circles.some((C) => C.cid === cid)) hideTags([plaques[cid]]);
}

// ============================================================ 7. STUDY UI
let toastTimer = null;
function toast(title, sub) {
  const el = $('toast'); el.textContent = title;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
  el.hidden = true; void el.offsetWidth; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}
const celebrate = () => { if (actor) env.burst(actor.pos.clone().setY(actor.vy + 1.4), 30); };
Study.send = (type, payload) => Net.send(type, payload);
Study.onChange = () => pushPresence();
Study.onEvent = (evt) => {
  const mins = (window.FABLE_CONFIG || {}).BREAK_MINUTES || 5;
  if (evt === 'soloDone') { Audio.sfx('chime'); celebrate(); toast('Break time!', 'Session complete. Stretch, sip, breathe.'); }
  if (evt === 'break') { Audio.sfx('chime'); celebrate(); toast('Break time!', mins + ' minutes together, then the next round.'); }
  if (evt === 'breakOver') { Audio.sfx('pop'); toast('Break is over', 'Start the next round when the circle is ready.'); }
  if (evt === 'circleStart') Audio.sfx('start');
  uiTick();
};
let soloMin = 25, circleMin = 25;
function chipGroup(selector, attr, inputEl, set) {
  const chips = [...document.querySelectorAll(selector)];
  chips.forEach((c) => { c.onclick = () => { chips.forEach((o) => o.classList.toggle('on', o === c)); inputEl.value = ''; set(+c.getAttribute(attr)); }; });
  inputEl.oninput = () => { const v = parseInt(inputEl.value, 10); if (v > 0) { chips.forEach((o) => o.classList.remove('on')); set(v); } };
}
chipGroup('[data-min]', 'data-min', $('soloCustom'), (v) => { soloMin = v; });
chipGroup('[data-cmin]', 'data-cmin', $('circleCustom'), (v) => { circleMin = v; });
$('studyBtn').onclick = () => { $('studyModal').hidden = false; };
$('soloCancel').onclick = () => { $('studyModal').hidden = true; };
$('soloGo').onclick = () => { Audio.unlock(); Audio.sfx('start'); Study.startSolo(soloMin, $('soloSubject').value.trim()); $('studyModal').hidden = true; uiTick(); };
$('soloStop').onclick = () => { Study.stopSolo(); uiTick(); };
$('circleStart').onclick = () => { Audio.unlock(); if (Study.myCircle) Study.startCircle(Study.myCircle, circleMin); uiTick(); };

// chat & emotes (focus mode = emotes only)
$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim().slice(0, 80);
  if (!text || Study.inFocus()) return;
  say(actor.tag, text); Net.send('c', { i: me.key, m: text }); $('chatInput').value = ''; $('chatInput').blur();
};
document.querySelectorAll('[data-emote]').forEach((b) => {
  b.onclick = () => { const i = +b.dataset.emote; say(actor.tag, EMOTES[i]); Net.send('e', { i: me.key, e: i }); env.burst(actor.pos.clone().setY(actor.vy + 1.6), 6); };
});

// ============================================================ 7b. HUD EXTRAS: mute, actions, guide, report, snapshot, hint
const CFG = window.FABLE_CONFIG || {};
const coarse = () => matchMedia('(pointer: coarse)').matches;
const closePopups = () => { $('mapPanel').hidden = true; $('actionMenu').hidden = true; $('setMenu').hidden = true; };

// ----- mute everything (music + effects), remembered by audio.js -----
function showMuted() { $('muteIco').textContent = Audio.muted ? '🔇' : '🔊'; $('muteState').textContent = Audio.muted ? 'on' : 'off'; $('muteBadge').hidden = !Audio.muted; $('muteBtn').setAttribute('aria-pressed', Audio.muted ? 'true' : 'false'); $('muteBtn').title = Audio.muted ? 'Sound is muted: click to unmute' : 'Mute all sound'; }
$('muteBtn').onclick = () => { Audio.unlock(); Audio.setMuted(!Audio.muted); showMuted(); };
showMuted();

// ----- actions menu -----
$('actBtn').onclick = () => { const m = $('actionMenu'), open = m.hidden; closePopups(); m.hidden = !open; };
document.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => doAction(+b.dataset.act); });

// ----- guide (tabs) -----
function openGuide(tab) {
  closePopups(); $('guideModal').hidden = false;
  document.querySelectorAll('#guideTabs .chip').forEach((c) => c.classList.toggle('on', c.dataset.tab === tab));
  document.querySelectorAll('#guideModal .pane').forEach((pn) => { pn.hidden = pn.dataset.pane !== tab; });
  if (tab === 'report') { $('repInfo').textContent = reportInfo().replace(/\n/g, ' · '); $('repStatus').textContent = ''; }
}
document.querySelectorAll('#guideTabs .chip').forEach((c) => { c.onclick = () => openGuide(c.dataset.tab); });
$('guideBtn').onclick = () => openGuide('move');
$('setBtn').onclick = () => { const m = $('setMenu'), open = m.hidden; closePopups(); m.hidden = !open; };
$('guideClose').onclick = () => { $('guideModal').hidden = true; canvas.focus({ preventScroll: true }); };

// ----- report an issue: Web3Forms if a key is set in config.js, otherwise the visitor's own email app -----
const reportInfo = () => 'Realm: ' + zone.name + '\nBrowser: ' + navigator.userAgent + '\nScreen: ' + vw + 'x' + vh + ' @' + (window.devicePixelRatio || 1) + 'x\nQuality: ' + (lowQ ? 'low' : 'high') + '\nMultiplayer: ' + (Net.isOnline() ? 'online' : 'solo');
$('reportForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('repName').value.trim(), email = $('repEmail').value.trim(), msg = $('repMsg').value.trim(), status = $('repStatus');
  if (!msg) { status.textContent = 'Please write a message first.'; return; }
  if ($('repBot').checked) return;                                  // honeypot: only bots tick a hidden box
  const body = msg + '\n\n---\n' + reportInfo(), key = CFG.WEB3FORMS_KEY, to = CFG.REPORT_EMAIL || 'hello@yasmine.page';
  const viaEmail = () => { location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Fablenook issue report') + '&body=' + encodeURIComponent((name ? 'From: ' + name + '\n\n' : '') + body); status.textContent = 'Opening your email app…'; };
  if (!key || /PASTE/.test(key)) return viaEmail();
  $('repSend').disabled = true; status.textContent = 'Sending…';
  try {
    const payload = { access_key: key, subject: 'Fablenook issue report', from_name: 'Fablenook', name: name || 'Anonymous visitor', message: body };
    if (email) payload.email = email;
    const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const out = await res.json();
    if (!out.success) throw new Error(out.message || 'not sent');
    status.textContent = 'Sent ✨ Thank you!'; $('repMsg').value = ''; Audio.sfx('start'); toast('Sent ✨', 'Thank you for helping Fablenook.');
  } catch (err) {
    status.textContent = 'Could not send from here.'; if (confirm('The report could not be sent directly. Open your email app instead?')) viaEmail();
  }
  $('repSend').disabled = false;
};

// ----- snapshot: copy the 3D view into a framed picture with the realm's name -----
let snapBlob = null, snapUrl = null;
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const star4 = (g, x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, k = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } g.closePath(); g.fill(); };
function takeSnapshot() {
  renderer.render(scene, camera);                                   // a fresh frame, copied in the same task (so no preserveDrawingBuffer is needed)
  const W = Math.min(canvas.width, 1600), k = W / canvas.width, H = Math.round(canvas.height * k), pad = Math.round(W * 0.028), foot = Math.round(W * 0.085), R = Math.round(W * 0.03);
  const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = H + pad + foot; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, cv.width, cv.height); ['#ffb3e6', '#d9b8ff', '#b5d8ff', '#b8ffe9', '#fff3b0', '#ffb3e6'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
  g.fillStyle = gr; rrect(g, 0, 0, cv.width, cv.height, R * 1.5); g.fill();                                   // holo frame
  g.save(); rrect(g, pad, pad, W, H, R); g.clip(); g.drawImage(canvas, 0, 0, canvas.width, canvas.height, pad, pad, W, H);
  if ($('snapTags').checked) {                                       // optional name tags, redrawn onto the picture
    const s = W / vw, people = [[actor, me.name]]; for (const id in others) if (others[id].zone === zone.id) people.push([others[id], others[id].name]);
    g.font = '600 ' + Math.round(13 * s) + "px 'Fredoka', 'Nunito', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [a, nm] of people) {
      proj.set(a.pos.x, a.vy + a.lift + (a.anim === ANIM.sit ? 1.3 : 1.72), a.pos.z).project(camera); if (proj.z > 1 || Math.abs(proj.x) > 1.1) continue;
      const x = pad + (proj.x * 0.5 + 0.5) * W, y = pad + (-proj.y * 0.5 + 0.5) * H, tw = g.measureText(nm).width + 20 * s, th = 22 * s;
      g.fillStyle = 'rgba(255,255,255,.92)'; rrect(g, x - tw / 2, y - th, tw, th, th / 2); g.fill(); g.fillStyle = '#5b4590'; g.fillText(nm, x, y - th / 2);
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(2, W * 0.004); rrect(g, pad, pad, W, H, R); g.stroke();
  const fy = H + pad + foot * 0.55;                                 // caption strip
  g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(120,80,210,.55)'; g.shadowBlur = foot * 0.12; g.shadowOffsetY = foot * 0.04;
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '400 ' + Math.round(foot * 0.46) + "px 'Bagel Fat One', 'Fredoka', sans-serif";
  star4(g, pad * 1.6 + foot * 0.18, fy, foot * 0.2); g.fillText('Fablenook · ' + zone.name, pad * 1.6 + foot * 0.5, fy);
  g.textAlign = 'right'; g.font = '600 ' + Math.round(foot * 0.26) + "px 'Fredoka', 'Nunito', sans-serif";
  g.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), cv.width - pad * 1.8 - foot * 0.3, fy);
  star4(g, cv.width - pad * 1.6 - foot * 0.1, fy - foot * 0.12, foot * 0.11);
  cv.toBlob((b) => {
    snapBlob = b; if (snapUrl) URL.revokeObjectURL(snapUrl); snapUrl = URL.createObjectURL(b); $('snapImg').src = snapUrl;
    const file = new File([b], 'fablenook.png', { type: 'image/png' });
    $('snapShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('snapCopy').hidden = !(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    $('snapSave').textContent = coarse() ? 'Save' : 'Download PNG';
  }, 'image/png');
}
$('snapBtn').onclick = () => {
  if (!joined) return; closePopups();
  $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on'); Audio.sfx('pop');
  takeSnapshot(); $('snapModal').hidden = false;
};
$('snapTags').onchange = takeSnapshot;
$('snapClose').onclick = () => { $('snapModal').hidden = true; canvas.focus({ preventScroll: true }); };
$('snapSave').onclick = () => { if (!snapUrl) return; const a = document.createElement('a'); a.href = snapUrl; a.download = 'fablenook-' + zone.id + '-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); };
$('snapCopy').onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': snapBlob })]); toast('Copied ✨', 'Paste it anywhere.'); } catch (e) { toast('Could not copy', 'Use Download instead.'); } };
$('snapShare').onclick = async () => { try { await navigator.share({ files: [new File([snapBlob], 'fablenook-' + zone.id + '.png', { type: 'image/png' })], title: 'Fablenook', text: 'Studying in ' + zone.name + ' ✦' }); } catch (e) { /* the visitor closed the share sheet */ } };

// ----- click / tap outside or Esc closes popups; that press never reaches the world -----
const POPUPS = [                                                     // topmost first
  { el: 'snapModal', card: '#snapModal .card', close: () => $('snapClose').click() },
  { el: 'guideModal', card: '#guideModal .card', close: () => closeGuideSafely() },
  { el: 'mapPanel', btn: 'mapBtn' }, { el: 'actionMenu', btn: 'actBtn' }, { el: 'setMenu', btn: 'setBtn' },
];
const reportDirty = () => !$('guideModal').hidden && !document.querySelector('#guideModal [data-pane="report"]').hidden && !!($('repMsg').value.trim() || $('repName').value.trim() || $('repEmail').value.trim());
function closeGuideSafely() {                                       // keep a half-written report unless the visitor says to throw it away
  if (reportDirty()) { if (!confirm('Discard your message?')) return false; $('repMsg').value = ''; $('repName').value = ''; $('repEmail').value = ''; $('repStatus').textContent = ''; }
  $('guideClose').click(); return true;
}
function closePopup(p) { if (p.close) p.close(); else $(p.el).hidden = true; }
window.addEventListener('pointerdown', (e) => {
  const open = POPUPS.filter((p) => !$(p.el).hidden); if (!open.length) return;
  let swallow = false;
  for (const p of open) {
    const inside = e.target.closest(p.card || '#' + p.el), own = p.btn && e.target.closest('#' + p.btn);
    if (inside || own) continue;                                    // its own button toggles it as before
    closePopup(p); swallow = true;
  }
  // A press that only closed a popup must not walk the character or turn the camera.
  if (swallow && (e.target === canvas || e.target.classList.contains('overlay'))) { e.stopPropagation(); e.preventDefault(); }
}, true);                                                           // capture: runs before the game's own listeners
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = POPUPS.find((p) => !$(p.el).hidden); if (!top) return;
  e.preventDefault(); closePopup(top); if ($(top.el).hidden) canvas.focus({ preventScroll: true });
});

// ----- first-visit controls hint -----
function maybeHint() {
  let seen = false; try { seen = localStorage.getItem('fablenook.hinted') === '1'; } catch (e) { /* ignore */ }
  if (seen) return;
  $('hintText').textContent = coarse()
    ? 'Press and hold the ground to walk toward your finger, or use the joystick under your left thumb. Drag the camera pad on the right (or a second finger, or the sky) to look around.'
    : 'Hold the left mouse button on the ground to walk toward the cursor (WASD works too). Drag the sky or right-drag to look around (or use the camera pad), scroll to zoom, Q / E to turn, F to interact, 1 to 6 for actions.';
  $('hintCard').hidden = false;
}
const hintDone = () => { $('hintCard').hidden = true; try { localStorage.setItem('fablenook.hinted', '1'); } catch (e) { /* ignore */ } };
$('hintOk').onclick = () => { hintDone(); canvas.focus({ preventScroll: true }); };
$('hintMore').onclick = () => { hintDone(); openGuide('move'); };

// refresh the DOM; runs 4x a second and after any change
function uiTick() {
  if (!joined) return;
  const now = Date.now();
  $('myMinutes').textContent = Study.total();
  const counts = zoneCounts();
  const oc = Net.isOnline() ? ' · <span class="hereTxt">' + counts[zone.id].here + ' here · </span>' + counts.all + ' online' : '';   // phones hide the "here" part
  if ($('onlineCount').innerHTML !== oc) $('onlineCount').innerHTML = oc;
  if (!$('mapPanel').hidden) drawMap(counts);
  const solo = Study.solo, here = circleAt(actor.pos), standing = !!here;
  $('studyBtn').hidden = !!solo || standing; $('soloPill').hidden = !solo;
  $('studyRow').hidden = $('studyBtn').hidden && $('soloPill').hidden;
  if (solo) $('soloText').textContent = '📖 ' + (solo.subject ? solo.subject + ' · ' : '') + FN.fmt(solo.endsAt - now);
  const focus = Study.inFocus();
  $('chatForm').hidden = focus; $('focusNote').hidden = !focus;
  $('circlePanel').hidden = !standing;
  if (standing) {
    const ph = Study.phase(here.cid, now), blocked = !!solo;
    $('circleTitle').textContent = here.name;
    $('circleStat').textContent = '✨ ' + Study.zoneTotal(here.cid) + ' minutes focused here today · ' + circleCount(here.cid) + ' here now';
    $('circleBlocked').hidden = !blocked; $('circleIdle').hidden = blocked || ph.name !== 'idle'; $('circleRunning').hidden = blocked || ph.name === 'idle';
    if (ph.name !== 'idle') {
      $('circleClock').textContent = (ph.name === 'focus' ? '' : '☕ ') + FN.fmt(ph.left);
      $('circleHint').textContent = ph.name === 'focus' ? 'Focus round of ' + ph.st.len + ' min. You earn minutes while you stay in the circle.' : 'Break together. The next round can start when it ends.';
    }
  }
  hudBottom = $('bottom').offsetHeight + 10;
}
// ----- zone map: who is where, and one-tap travel -----
function zoneCounts() {
  const c = { all: 1 }; for (const z of ZONE_ORDER) c[z] = { here: 0, studying: 0 };
  c[zone.id].here++; if (Study.solo || (Study.myCircle && Study.phase(Study.myCircle).name === 'focus')) c[zone.id].studying++;
  for (const k in others) { const o = others[k], z = c[o.zone]; if (!z) continue; c.all++; z.here++; if ((o.so && o.so.e > Date.now()) || (o.ci && Study.phase(o.ci).name === 'focus')) z.studying++; }
  return c;
}
function drawMap(counts) {
  const list = $('mapList');
  if (list.children.length !== ZONE_ORDER.length) {          // build the rows once; later calls only update text
    list.innerHTML = '';
    for (const id of ZONE_ORDER) {
      const row = document.createElement('div'); row.className = 'mapRow'; row.dataset.zone = id;
      const dot = document.createElement('i'); dot.style.background = ZONES[id].accent;
      const txt = document.createElement('div'), nm = document.createElement('b'), sub = document.createElement('small');
      nm.textContent = ZONES[id].name; nm.style.color = ZONES[id].ui; txt.append(nm, sub);
      const go = document.createElement('button'); go.className = 'chip'; go.onclick = () => { if (id !== zone.id) travel(id); };
      row.append(dot, txt, go); list.appendChild(row);
    }
  }
  for (const row of list.children) {
    const id = row.dataset.zone, here = id === zone.id, go = row.querySelector('button'), sub = row.querySelector('small');
    const t = counts[id].here + ' here · ' + counts[id].studying + ' studying'; if (sub.textContent !== t) sub.textContent = t;
    row.classList.toggle('here', here); go.disabled = here; const g = here ? 'You are here' : 'Travel'; if (go.textContent !== g) go.textContent = g;
  }
}
$('mapBtn').onclick = () => { const p = $('mapPanel'), open = p.hidden; closePopups(); p.hidden = !open; if (open) drawMap(zoneCounts()); };
$('mapClose').onclick = () => { $('mapPanel').hidden = true; };
setInterval(() => { Study.tick(); uiTick(); }, 250);     // setInterval keeps the timers alive in background tabs

// ============================================================ 8. LOOP
const focusPt = new THREE.Vector3(), earDir = new THREE.Vector3();
let last = performance.now(), gapMs = 16, slow = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const gap = nowMs - last, dt = Math.min(0.05, gap / 1000), t = nowMs / 1000, now = Date.now(); last = nowMs;
  const sunset = FN.sunset(now);

  let heading = null;
  if (joined) { heading = updateMe(dt); updateOthers(dt); sendPosition(false); }
  zone.update(dt, t, { playerPos: joined ? actor.pos : null, trail: env.trail });

  // camera: follows me, or circles the island on the title / character screens
  if (joined) { focusPt.set(actor.pos.x, actor.vy + actor.lift + (actor.anim === ANIM.sit ? 0.95 : 1.3), actor.pos.z); rig.update(dt, focusPt, heading, input, t);
    Audio.listen(focusPt, camera.getWorldDirection(earDir)); }
  else { const a = t * 0.07; camera.position.set(Math.sin(a) * 34, 11 + Math.sin(t * 0.2) * 1.5, Math.cos(a) * 34 + 2); camera.lookAt(0, 3.5, -3); }
  // keep the character clear of the bottom HUD by shifting the picture up a little
  const wantShift = joined ? Math.min(hudBottom, vh * 0.42) * 0.42 : 0; viewShift += (wantShift - viewShift) * Math.min(1, dt * 5);
  camera.setViewOffset(vw, vh, 0, viewShift, vw, vh);

  env.update(dt, t, sunset, camera.position, scene.fog, hemi, sun);       // sky, fog, lights, weather, sparkles

  renderer.render(scene, camera);
  updateLabels(now);
  if (preview) renderPreview(dt, t);

  // adaptive quality: if frames stay slow for a couple of seconds, drop to low quality once
  gapMs += (Math.min(100, gap) - gapMs) * 0.05;
  if (autoQ && !lowQ && gapMs > 27) { if (++slow > 100) setLow(true); } else slow = 0;
}

resize(); showZone(START_ZONE); setLow(lowQ); buildJoin();
canvas.tabIndex = 0; window.focus(); canvas.focus({ preventScroll: true });       // grab keyboard focus on load
window.addEventListener('pointerdown', (e) => { if (!/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) window.focus(); });
requestAnimationFrame(frame);
FN._debug = { me, others, built, travel, input, goto: (x, z) => { let y = null; for (let h = 6; h >= -1 && y === null; h -= 0.5) y = zone.ground(x, h, z); if (y === null) return false; click = { x, y, z, best: 1e9, since: 0, detour: 0, side: 1, tries: 0 }; return true; }, redress: () => dress(actor, me), doAction, takeSnapshot, get click() { return click; }, get world() { return zone; }, get zone() { return zone; }, rig, camera, scene, renderer, get actor() { return actor; }, perf: () => ({ gap: +gapMs.toFixed(1), lowQ, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), setLow: (v) => { autoQ = false; setLow(v); },
  walk: (dx, dz, steps) => { for (let i = 0; i < steps; i++) tryMove(actor.pos, dx, dz, zone); return [actor.pos.x, actor.pos.y, actor.pos.z].map((v) => +v.toFixed(2)); } };   // test helper: walk in a straight line
