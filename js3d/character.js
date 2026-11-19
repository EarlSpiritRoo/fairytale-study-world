/* ============================================================
   character.js — low-poly chibi avatars and pets, built from
   primitives and animated procedurally (no model files).

   makeAvatar(look)  look = { kind, scheme, skin }
   makePet(type, scale, color)
   Both return { group, update(dt, state) }.
     avatar state: { move: 0 idle | 1 walk | 2 run, sit: bool }
     pet state:    { move: 0..1, fly: bool }
   Models face +Z; feet are at y = 0.
   ============================================================ */
import * as THREE from 'three';
import { toon, outline, holo, flat } from './toon.js';

export const KINDS = ['princess', 'prince', 'mermaid', 'fairy'];
export const PETS = ['kitten', 'puppy', 'bunny', 'pegasus'];
export const PET_LABEL = { kitten: 'Kitten', puppy: 'Puppy', bunny: 'Bunny', pegasus: 'Baby winged horse' };
export const SCHEMES = [
  { name: 'Rose', main: '#ff9fcf', accent: '#fff0a8', hair: '#9a5a4a' },
  { name: 'Lilac', main: '#c9adff', accent: '#ffe6f7', hair: '#6a4a9a' },
  { name: 'Mint', main: '#9fecd0', accent: '#ffd1e8', hair: '#f4c95d' },
  { name: 'Sky', main: '#a6d4ff', accent: '#ffffff', hair: '#4a4670' },
  { name: 'Sunbeam', main: '#ffdc8f', accent: '#ffa6c4', hair: '#d06a48' },
  { name: 'Midnight', main: '#8088e0', accent: '#fff0a8', hair: '#2c2850' },
];
export const SKINS = ['#ffe6d6', '#f6cdaa', '#cf966c', '#93613f'];

// ---------- shared geometry (unit shapes, scaled per part) ----------
const SPHERE = new THREE.SphereGeometry(1, 10, 7);
const CAP = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.58);     // hair cap
const LIMB = new THREE.CapsuleGeometry(1, 4, 2, 6);                                   // radius 1, total length 6
const CONE = new THREE.ConeGeometry(1, 1, 5);
const cylCache = {};
const cyl = (rt, rb, h, seg = 12) => cylCache[[rt, rb, h, seg]] || (cylCache[[rt, rb, h, seg]] = new THREE.CylinderGeometry(rt, rb, h, seg));
const DARK = '#4a2f5e';

// one outlined, cel-shaded part.  o = { p: position, s: scale, r: rotation, ink: false to skip outline, mat }
function part(parent, geo, color, o = {}) {
  const m = new THREE.Mesh(geo, o.mat || toon(color));
  if (o.p) m.position.set(...o.p);
  if (o.s) { if (typeof o.s === 'number') m.scale.setScalar(o.s); else m.scale.set(...o.s); }
  if (o.r) m.rotation.set(...o.r);
  if (o.ink !== false) outline(m);
  if (o.tag) m.userData.tag = o.tag;                    // 'hair' / 'cape' / 'body' (used by the clipping test)
  parent.add(m); return m;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const ease = (cur, target, dt, k) => cur + (target - cur) * Math.min(1, dt * k);

// ============================================================
//  BODY CAPSULE: keeps long hair and the prince's cape outside the body
// ============================================================
// Everything here is in the avatar's rig frame, seen from the side: y up, z forward.
// profile() records, for the current pose, how far BACK the body reaches at each height
// (torso, skirt, trunk, arms, legs, tail). clearBody() takes a hanging part's wanted swing angle
// and increases it until every sample point on the part's front face is behind that profile.
const HAIR = { c: [0, -0.28, -0.07], s: [0.27, 0.34, 0.13] };          // the back hair blob (centre and radii, in its pivot frame)
const HAIR_PIVOT = { head: [1.13, 0], at: [0.05, -0.2] };               // pivot: on the head at (y, z), head centre at rig (y, z)
const HAIR_SAMPLES = [-0.98, -0.85, -0.65, -0.4, -0.1, 0.25].map((u) => [HAIR.c[1] + HAIR.s[1] * u, HAIR.c[2] + HAIR.s[2] * Math.sqrt(1 - u * u)]);
const CAPE_PIVOT = { head: [0, 0], at: [0.96, -0.13] };
const CAPE_SAMPLES = [0.06, 0.18, 0.3, 0.42, 0.54, 0.62].map((d) => [-d, 0.016]);
const MARGIN = 0.025, BIN = 0.04, Y0 = -0.2, NB = 45;                 // profile bins: 4 cm tall, from y = -0.2 to 1.6
const back = new Float32Array(NB);
const mark = (y, b) => { const i = Math.floor((y - Y0) / BIN); if (i >= 0 && i < NB && b > back[i]) back[i] = b; };
const circle = (yc, zc, r) => { for (let y = yc - r; y <= yc + r + 1e-6; y += BIN * 0.5) mark(y, -zc + Math.sqrt(Math.max(0, r * r - (y - yc) * (y - yc)))); };
// a limb hanging from pivot (py, pz), rotated `ang` about x, as discs of radius r along its length
const limb = (py, pz, ang, len, r, n = 5) => { const c = Math.cos(ang), s = Math.sin(ang); for (let i = 0; i <= n; i++) { const d = len * i / n; circle(py - d * c, pz - d * s, r); } };
function profile(kind, A, arms, legs, tailA, tailB) {
  back.fill(-9);
  for (let y = 0.59; y <= 0.99; y += 0.02) { const t = (y - 0.79) / 0.2; mark(y, 0.155 * Math.sqrt(Math.max(0, 1 - t * t))); }      // torso
  if (kind === 'princess') { const sy = 1 - A.sit * 0.42, sr = 1 + A.sit * 0.25, h = 0.66 * sy;                                   // skirt (+ hem ring)
    for (let y = 0.72 - h; y <= 0.72; y += 0.02) mark(y, (0.17 + 0.3 * (0.72 - y) / h) * sr + 0.04); }
  if (kind === 'prince') for (let y = 0.5; y <= 0.82; y += 0.02) mark(y, 0.17 + 0.055 * (0.81 - y) / 0.3 + 0.03);              // trunk + belt
  if (kind === 'fairy') for (let y = 0.43; y <= 0.77; y += 0.02) mark(y, 0.23);                                                     // petal skirt
  for (const a of arms) limb(0.9, 0, a.rotation.x, 0.3, kind === 'princess' ? 0.07 : 0.055);
  if (kind === 'princess') for (const a of arms) circle(0.9, 0, 0.09);                                                               // puff sleeves
  for (const l of legs) { limb(0.56, 0, l.rotation.x, 0.44, 0.07); const c = Math.cos(l.rotation.x), s = Math.sin(l.rotation.x); circle(0.56 - 0.5 * c, -0.5 * s, 0.1); }
  if (tailA) { const a = tailA.rotation.x, b = a + tailB.rotation.x; limb(0.66, 0, a, 0.36, 0.19);
    const ey = 0.66 - 0.36 * Math.cos(a), ez = -0.36 * Math.sin(a); limb(ey, ez, b, 0.33, 0.12); }
}
const behind = (y) => { const i = Math.floor((y - Y0) / BIN); return i >= 0 && i < NB ? back[i] : -9; };
function clearBody(want, headRot, samples, P) {
  const ch = Math.cos(headRot), sh = Math.sin(headRot);
  let a = Math.min(want, 1.35);
  for (let it = 0; it < 30; it++) {
    const c = Math.cos(a), s = Math.sin(a); let ok = true;
    for (const [y, z] of samples) {
      const y1 = y * c - z * s + P.at[0], z1 = y * s + z * c + P.at[1];          // swing about the pivot, then place the pivot
      const Y = y1 * ch - z1 * sh + P.head[0], Z = y1 * sh + z1 * ch + P.head[1];  // then the head's own tilt (hair only)
      if (Z > -(behind(Y) + MARGIN)) { ok = false; break; }
    }
    if (ok || a >= 1.35) return a;
    a += 0.035;
  }
  return a;
}

// ============================================================
//  AVATAR
// ============================================================
export function makeAvatar(look) {
  const sc = SCHEMES[look.scheme] || SCHEMES[0], skin = SKINS[look.skin] || SKINS[0], kind = KINDS.includes(look.kind) ? look.kind : 'fairy';
  const legged = kind === 'prince' || kind === 'fairy', floaty = kind === 'mermaid' || kind === 'fairy';
  const group = new THREE.Group(), rig = pivot(group, 0, 0, 0);

  // ----- head -----
  const head = pivot(rig, 0, 1.13, 0);
  part(head, SPHERE, skin, { s: [0.32, 0.3, 0.3] });
  part(head, CAP, sc.hair, { s: [0.345, 0.34, 0.335], p: [0, 0.03, -0.03], r: [-0.42, 0, 0] });
  for (const s of [-1, 1]) {
    part(head, SPHERE, sc.hair, { s: [0.11, 0.1, 0.09], p: [s * 0.2, 0.19, 0.2], ink: false });            // fringe
    const eye = part(head, SPHERE, DARK, { s: [0.046, 0.064, 0.02], p: [s * 0.115, 0, 0.283], ink: false, mat: flat(DARK) });
    eye.userData.eye = true;
    part(head, SPHERE, '#fff', { s: [0.016, 0.016, 0.008], p: [s * 0.115 + 0.014, 0.024, 0.3], ink: false, mat: flat('#ffffff') });
    part(head, SPHERE, '#ff9ab8', { s: [0.05, 0.03, 0.01], p: [s * 0.205, -0.085, 0.235], ink: false, mat: flat('#ff9ab8', { transparent: true, opacity: 0.55 }) });
  }
  part(head, SPHERE, '#c0607a', { s: [0.03, 0.012, 0.01], p: [0, -0.1, 0.292], ink: false, mat: flat('#c0607a') });
  const eyes = head.children.filter((c) => c.userData.eye);

  let hairBack = null;
  if (kind !== 'prince') {                                   // long hair that trails behind
    // hangs from the back of the head, sitting a little OUT from the back so it never rests inside the body
    hairBack = pivot(head, 0, 0.05, -0.2);
    part(hairBack, SPHERE, sc.hair, { s: HAIR.s, p: HAIR.c, tag: 'hair' });
    for (const s of [-1, 1]) part(head, SPHERE, sc.hair, { s: [0.065, 0.12, 0.07], p: [s * 0.3, -0.03, -0.12], ink: false, tag: 'hair' });
  }
  // accessory
  if (kind === 'princess' || kind === 'prince') {
    const crown = pivot(head, 0, 0.3, 0);
    part(crown, cyl(0.13, 0.1, 0.09, 5), '#ffe07a');
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(crown, SPHERE, '#fff8d0', { s: 0.028, p: [Math.cos(a) * 0.125, 0.065, Math.sin(a) * 0.125], ink: false }); }
    if (kind === 'prince') crown.scale.setScalar(1.15);
  } else if (kind === 'mermaid') {
    part(head, new THREE.OctahedronGeometry(0.07), sc.accent, { p: [-0.2, 0.25, 0.12] });
    part(head, SPHERE, '#ffffff', { s: 0.035, p: [-0.1, 0.3, 0.14], ink: false });
  } else {
    for (const s of [-1, 1]) { part(head, cyl(0.012, 0.012, 0.2, 5), sc.hair, { p: [s * 0.09, 0.4, 0.05], r: [0, 0, -s * 0.3], ink: false }); part(head, SPHERE, sc.accent, { s: 0.04, p: [s * 0.125, 0.5, 0.05] }); }
  }

  // ----- torso + arms -----
  part(rig, SPHERE, kind === 'mermaid' ? skin : sc.main, { s: [0.185, 0.2, 0.155], p: [0, 0.79, 0], tag: 'body' });
  const arms = [-1, 1].map((s) => {
    const a = pivot(rig, s * 0.2, 0.9, 0);
    if (kind === 'princess') part(a, SPHERE, sc.accent, { s: 0.085, p: [s * 0.01, 0, 0], tag: 'body' });                // puff sleeve
    part(a, LIMB, skin, { s: [0.048, 0.042, 0.048], p: [s * 0.03, -0.15, 0], tag: 'body' });
    part(a, SPHERE, skin, { s: 0.055, p: [s * 0.03, -0.29, 0], ink: false, tag: 'body' });
    a.rotation.z = s * 0.14; a.userData.side = s; return a;
  });

  // ----- lower body, per kind -----
  let legs = [], skirt = null, cape = null, wings = [], tailA = null, tailB = null;
  if (legged) {
    legs = [-1, 1].map((s) => {
      const l = pivot(rig, s * 0.09, 0.56, 0);
      part(l, LIMB, kind === 'prince' ? '#5d5388' : skin, { s: [0.058, 0.066, 0.058], p: [0, -0.24, 0], tag: 'body' });
      part(l, SPHERE, kind === 'prince' ? '#8a6652' : sc.accent, { s: [0.075, 0.055, 0.105], p: [0, -0.5, 0.03], tag: 'body' });
      return l;
    });
  }
  if (kind === 'princess') {
    skirt = pivot(rig, 0, 0.72, 0);
    part(skirt, cyl(0.17, 0.47, 0.66, 14), sc.main, { p: [0, -0.33, 0], tag: 'body' });
    part(skirt, new THREE.TorusGeometry(0.46, 0.035, 6, 18), sc.accent, { p: [0, -0.64, 0], r: [Math.PI / 2, 0, 0], ink: false });
    part(rig, SPHERE, sc.accent, { s: [0.07, 0.045, 0.04], p: [0, 0.72, 0.16], ink: false });               // bow
  } else if (kind === 'prince') {
    part(rig, cyl(0.17, 0.225, 0.3, 12), sc.main, { p: [0, 0.66, 0], tag: 'body' });
    part(rig, new THREE.TorusGeometry(0.2, 0.028, 6, 14), sc.accent, { p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0], ink: false });
    cape = pivot(rig, 0, 0.96, -0.13);
    part(cape, new THREE.BoxGeometry(0.42, 0.62, 0.03), sc.accent, { p: [0, -0.31, 0], tag: 'cape' });
  } else if (kind === 'fairy') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(rig, SPHERE, i % 2 ? sc.accent : sc.main, { s: [0.1, 0.17, 0.07], p: [Math.sin(a) * 0.13, 0.6, Math.cos(a) * 0.13], r: [0.5 * Math.cos(a), 0, -0.5 * Math.sin(a)], tag: 'body' }); }
    wings = [-1, 1].map((s) => {
      const w = pivot(rig, s * 0.04, 0.95, -0.14);
      part(w, new THREE.CircleGeometry(1, 12), '#fff', { s: [0.26, 0.4, 1], p: [s * 0.27, 0.12, 0], mat: holo(0.8, true), ink: false });
      part(w, new THREE.CircleGeometry(1, 10), '#fff', { s: [0.17, 0.22, 1], p: [s * 0.2, -0.22, 0], mat: holo(0.8, true), ink: false });
      w.userData.side = s; return w;
    });
  } else {                                                   // mermaid tail: two bending segments + fin
    for (const s of [-1, 1]) part(rig, SPHERE, sc.accent, { s: 0.075, p: [s * 0.08, 0.84, 0.115], ink: false });
    tailA = pivot(rig, 0, 0.66, 0);
    part(tailA, cyl(0.19, 0.125, 0.36, 12), sc.main, { p: [0, -0.18, 0], tag: 'body' });
    tailB = pivot(tailA, 0, -0.36, 0);
    part(tailB, cyl(0.125, 0.06, 0.3, 10), sc.main, { p: [0, -0.15, 0], tag: 'body' });
    for (const s of [-1, 1]) part(tailB, SPHERE, sc.accent, { s: [0.17, 0.035, 0.1], p: [s * 0.12, -0.33, 0], r: [0, 0, s * 0.5] });
  }

  // ----- animation state -----
  const A = { phase: 0, move: 0, run: 0, sit: 0, dance: 0, wave: 0, cheer: 0, spin: 0, spinW: 0, t: Math.random() * 10 };
  const sitDrop = legged ? 0.47 : kind === 'princess' ? 0.3 : 0.45;   // tuned so every kind's seat ends ~3 cm above its origin (see SIT_BASE)

  function update(dt, st) {
    A.t += dt;
    A.move = ease(A.move, st.move ? 1 : 0, dt, 10); A.run = ease(A.run, st.move === 2 ? 1 : 0, dt, 8); A.sit = ease(A.sit, st.sit ? 1 : 0, dt, 7);
    A.phase += dt * (6 + A.run * 5) * (st.move ? 1 : 0.2 * A.move);
    const sw = Math.sin(A.phase), m = A.move * (1 - A.sit), up = 1 - A.sit;

    // body bounce, run lean, hover for the floaty kinds
    rig.position.y = Math.abs(sw) * 0.05 * m + Math.sin(A.t * 2.2) * 0.012 - A.sit * sitDrop + (floaty ? (0.1 + Math.sin(A.t * 2.6) * 0.035) * up : 0);
    rig.rotation.x = A.run * 0.2 * up + (kind === 'mermaid' ? m * 0.25 : 0);
    rig.rotation.z = sw * 0.03 * m;
    // ----- actions: st.act = 'dance' | 'wave' | 'spin' | 'cheer' (each blends in and out) -----
    A.dance = ease(A.dance, st.act === 'dance' ? 1 : 0, dt, 8); A.wave = ease(A.wave, st.act === 'wave' ? 1 : 0, dt, 9); A.cheer = ease(A.cheer, st.act === 'cheer' ? 1 : 0, dt, 9);
    A.spinW = ease(A.spinW, st.act === 'spin' ? 1 : 0, dt, 9); A.spin = st.act === 'spin' ? A.spin + dt * 7.6 : 0;
    const beat = Math.sin(A.t * 8), swing = Math.sin(A.t * 4);
    rig.position.y += A.dance * Math.abs(beat) * 0.07 + A.cheer * Math.abs(Math.sin(A.t * 7)) * 0.3;
    rig.rotation.z += A.dance * swing * 0.14; rig.rotation.y = A.spin + A.dance * swing * 0.5;
    head.rotation.x = -A.run * 0.12 + A.sit * 0.12 + Math.sin(A.t * 1.3) * 0.02;
    const blink = (A.t * 0.31) % 1 > 0.955 ? 0.12 : 1; for (const e of eyes) e.scale.y = 0.064 * blink;

    for (const a of arms) {
      const s = a.userData.side;
      a.rotation.x = -s * sw * (0.6 + A.run * 0.5) * m - A.sit * 0.75 - A.dance * (1.5 + s * beat * 0.7) - A.cheer * (2.6 + Math.sin(A.t * 14) * 0.2);
      a.rotation.z = s * (0.14 + A.run * 0.12 + A.sit * 0.12 + A.dance * 0.45 + A.cheer * 0.3 + A.spinW * 1.25 + (s > 0 ? A.wave * (2.35 + Math.sin(A.t * 11) * 0.38) : 0));
    }
    legs.forEach((l, i) => { l.rotation.x = (i ? -1 : 1) * (sw * (0.65 + A.run * 0.35) * m + A.dance * beat * 0.4) - A.sit * 1.45; l.rotation.z = (i ? 1 : -1) * A.sit * 0.12; });
    // Hair and cape: positive angle = swing BACK (away from the body). Sway is gentle and limited; then
    // clearBody() tilts them further back only as much as needed to stay outside the body in this pose.
    if (hairBack || cape) profile(kind, A, arms, legs, tailA, tailB);
    if (hairBack) {
      A.hair = ease(A.hair ?? 0.08, 0.08 + m * (0.16 + A.run * 0.14) + Math.sin(A.t * 1.7) * 0.025 + A.sit * 0.1 + A.dance * Math.abs(swing) * 0.1 + A.cheer * 0.12, dt, 7);
      hairBack.rotation.x = clearBody(A.hair, head.rotation.x, HAIR_SAMPLES, HAIR_PIVOT);
    }
    if (skirt) { skirt.scale.set(1 + A.sit * 0.25, 1 - A.sit * 0.42, 1 + A.sit * 0.25); skirt.rotation.z = sw * 0.06 * m + A.dance * swing * 0.14; skirt.rotation.x = -m * 0.08; }
    if (cape) {
      A.cape = ease(A.cape ?? 0.2, 0.2 + m * (0.32 + A.run * 0.22) + Math.sin(A.t * 2 + sw) * 0.035 + A.sit * 0.45 + A.dance * Math.abs(swing) * 0.15 + A.cheer * 0.2, dt, 8);
      cape.rotation.x = clearBody(A.cape, 0, CAPE_SAMPLES, CAPE_PIVOT);
    }
    for (const w of wings) w.rotation.y = w.userData.side * (0.35 + (0.5 + 0.5 * Math.sin(A.t * (16 + m * 8))) * 0.75);
    if (tailA) {
      tailA.rotation.x = 0.45 + m * 0.35 - A.sit * 1.75; tailA.rotation.z = sw * 0.22 * m + Math.sin(A.t * 1.5) * 0.05 * up;
      tailB.rotation.x = 0.35 + Math.sin(A.t * 2) * 0.1 * up + A.sit * 0.5; tailB.rotation.z = Math.sin(A.phase - 0.9) * 0.4 * m;
    }
  }
  update(0, { move: 0, sit: false });
  return { group, update, height: 1.5 };
}
export const SIT_BASE = 0.03;                           // how far above its origin a seated avatar's seat is

// ============================================================
//  PETS (also used, scaled up, for NPC pegasi and the sky flyers)
// ============================================================
const PET_STYLE = {
  kitten: { body: '#ffd29c', ear: 'point', tail: 'curl' },
  puppy: { body: '#e6b78c', ear: 'flop', tail: 'wag', dark: '#b3744a' },
  bunny: { body: '#fffaf5', ear: 'long', tail: 'puff' },
  pegasus: { body: '#ffffff', ear: 'point', tail: 'flow', mane: '#ff9fd6', wings: true },
};
export function makePet(type, scale = 1, color) {
  const st = PET_STYLE[type] || PET_STYLE.kitten, body = color || st.body;
  const group = new THREE.Group(), rig = pivot(group, 0, 0, 0);
  group.scale.setScalar(scale);
  part(rig, SPHERE, body, { s: [0.17, 0.155, 0.25], p: [0, 0.27, 0] });
  const head = pivot(rig, 0, 0.42, 0.22);
  part(head, SPHERE, body, { s: [0.15, 0.14, 0.14] });
  for (const s of [-1, 1]) {
    part(head, SPHERE, DARK, { s: [0.026, 0.034, 0.012], p: [s * 0.065, 0.01, 0.128], ink: false, mat: flat(DARK) });
    part(head, SPHERE, '#ff9ab8', { s: [0.03, 0.02, 0.008], p: [s * 0.1, -0.04, 0.105], ink: false, mat: flat('#ff9ab8', { transparent: true, opacity: 0.5 }) });
    if (st.ear === 'point') part(head, CONE, body, { s: [0.05, 0.1, 0.04], p: [s * 0.085, 0.14, 0] });
    if (st.ear === 'flop') part(head, SPHERE, st.dark, { s: [0.04, 0.09, 0.05], p: [s * 0.14, 0.02, 0], r: [0, 0, s * 0.3] });
    if (st.ear === 'long') { part(head, SPHERE, body, { s: [0.04, 0.15, 0.035], p: [s * 0.06, 0.22, -0.02], r: [0, 0, -s * 0.15] }); part(head, SPHERE, '#ffb8d6', { s: [0.018, 0.1, 0.01], p: [s * 0.06, 0.22, 0.012], r: [0, 0, -s * 0.15], ink: false }); }
  }
  if (type === 'pegasus') {
    part(head, SPHERE, body, { s: [0.085, 0.075, 0.1], p: [0, -0.04, 0.13] });
    for (let i = 0; i < 4; i++) part(rig, SPHERE, st.mane, { s: 0.06 - i * 0.004, p: [0, 0.54 - i * 0.07, 0.14 - i * 0.06], ink: false });
    part(head, SPHERE, '#e7a8c0', { s: 0.016, p: [0, -0.04, 0.228], ink: false });
  } else part(head, SPHERE, '#c0607a', { s: [0.02, 0.014, 0.012], p: [0, -0.02, 0.138], ink: false });
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => {
    const l = pivot(rig, sx * 0.09, 0.2, sz * 0.14);
    part(l, LIMB, st.dark || body, { s: [0.036, 0.03, 0.036], p: [0, -0.1, 0] });
    l.userData.ph = i === 0 || i === 3 ? 0 : Math.PI; return l;
  });
  const tail = pivot(rig, 0, 0.32, -0.22);
  if (st.tail === 'puff') part(tail, SPHERE, '#ffffff', { s: 0.065 });
  else if (st.tail === 'flow') for (let i = 0; i < 4; i++) part(tail, SPHERE, st.mane, { s: 0.055 - i * 0.006, p: [0, -i * 0.06, -i * 0.045], ink: false });
  else part(tail, LIMB, st.tail === 'wag' ? st.dark : body, { s: [0.03, 0.035, 0.03], p: [0, 0.08, -0.06], r: [-0.6, 0, 0] });
  const wings = st.wings ? [-1, 1].map((s) => { const w = pivot(rig, s * 0.1, 0.38, -0.02); part(w, SPHERE, '#f1f5ff', { s: [0.2, 0.025, 0.11], p: [s * 0.19, 0.02, -0.02] }); part(w, SPHERE, '#ffe1f3', { s: [0.12, 0.02, 0.08], p: [s * 0.14, 0.03, -0.08], ink: false }); w.userData.side = s; return w; }) : [];

  const A = { phase: 0, move: 0, t: Math.random() * 10 };
  function update(dt, s) {
    A.t += dt; A.move = ease(A.move, s.move ? 1 : 0, dt, 9);
    A.phase += dt * (type === 'bunny' ? 9 : 13) * A.move;
    const sw = Math.sin(A.phase), fly = s.fly ? 1 : 0;
    rig.position.y = fly ? Math.sin(A.t * 2) * 0.05 : Math.abs(sw) * (type === 'bunny' ? 0.13 : 0.045) * A.move + Math.sin(A.t * 2.4) * 0.006;
    rig.rotation.x = fly ? -0.1 : (type === 'bunny' ? -Math.cos(A.phase * 2) * 0.12 * A.move : 0);
    head.rotation.x = Math.sin(A.t * 1.6) * 0.06 + A.move * 0.05;
    for (const l of legs) l.rotation.x = fly ? 0.9 : Math.sin(A.phase + l.userData.ph) * 0.7 * A.move;
    tail.rotation.y = Math.sin(A.t * (st.tail === 'wag' ? 14 : 3)) * (st.tail === 'wag' ? 0.5 : 0.2);
    tail.rotation.x = st.tail === 'flow' ? -0.2 - A.move * 0.5 - fly * 0.8 : 0;
    for (const w of wings) w.rotation.z = w.userData.side * (0.15 + Math.sin(A.t * (fly ? 7 : A.move ? 11 : 2.5)) * (fly ? 0.75 : 0.25));
  }
  update(0, { move: 0 });
  return { group, update, height: 0.6 * scale };
}
