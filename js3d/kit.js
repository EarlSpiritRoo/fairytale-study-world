/* ============================================================
   kit.js — the ZONE BUILDING KIT. Every realm is built with the
   same helpers, so they share one look and one collision model.

   const K = makeKit('lagoon', seed);      // one kit per zone
   K.floor / K.island / K.mesa             ground to stand on
   K.stairs / K.ramp / K.bridge            ways between levels
   K.tree / K.crystal / K.lamp / K.path    props (instanced)
   K.seats + K.setCircle                   the Study Circle
   K.portals                               gates to the other realms
   K.npc / K.thing                         "Press E" interactions
   K.drift                                 butterflies, jellyfish, fairies
   return K.finish({ spawn, env })         → the zone object main.js uses

   COLLISION MODEL (no physics engine)
     Walkable shapes go through K.solid(). To move, the game asks
     zone.ground(): it looks straight down through every solid
     and keeps the highest surface within step height of your
     feet. No surface (an edge) or a solid overlapping your body
     (a wall, a cliff) means "blocked". Stairs, slopes and bridges
     are just solids. K.wall / K.post add push-out shapes for
     things you walk around.

   Units are metres. +X east, +Y up, +Z south. An avatar is ~1.5 tall.
   ============================================================ */
import * as THREE from 'three';
import { toon, outline, holo, glow, flat, blobTexture, Batch, rng, THEME, uTime } from './toon.js';
import { makeAvatar, makePet } from './character.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function lerpAngle(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); }
const STEP = 0.55, DROP = 0.75, BODY = 1.5;            // max step up, max step down, body height

// the five realms: display name, glow colour of their portal, UI accent
export const ZONES = {
  skyfield: { name: 'Skyfield', accent: '#b5d8ff', ui: '#8a74e8' },
  lagoon: { name: 'Coral Lagoon', accent: '#7fe9e0', ui: '#2f9fb5' },
  hollyhollow: { name: 'Hollyhollow', accent: '#ffd98a', ui: '#5b6fc0' },
  pavilion: { name: 'Moonlit Pavilion', accent: '#c9adff', ui: '#5a63c8' },
  petalwood: { name: 'Petalwood', accent: '#ffb3d9', ui: '#3fa77a' },
};
export const ZONE_ORDER = Object.keys(ZONES);

// shared prop geometry
const G = {
  puff: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.IcosahedronGeometry(1, 0), disc: new THREE.CylinderGeometry(1, 1, 0.06, 14), sphere: new THREE.SphereGeometry(1, 10, 8),
  trunk: new THREE.CylinderGeometry(0.16, 0.24, 1.7, 7), crystal: new THREE.CylinderGeometry(0, 0.34, 1, 5), crystalBase: new THREE.CylinderGeometry(0.34, 0.26, 0.5, 5),
  stem: new THREE.CylinderGeometry(0.025, 0.03, 0.4, 5), petal: new THREE.IcosahedronGeometry(0.13, 0), blob: new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
  lampPost: new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6), star: new THREE.OctahedronGeometry(0.2), fence: new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6),
  tuft: new THREE.ConeGeometry(0.09, 0.3, 4), keelTip: new THREE.ConeGeometry(0.5, 2.2, 5).rotateX(Math.PI), cone: new THREE.ConeGeometry(1, 1, 7), box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12), dome: new THREE.SphereGeometry(1, 14, 7, 0, 6.283, 0, Math.PI / 2), plane: new THREE.PlaneGeometry(1, 1), ropePost: new THREE.CylinderGeometry(0.06, 0.08, 1.0, 6),
  cushion: new THREE.SphereGeometry(1, 10, 6),
};
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#5a46a0', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const COL = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const RAINBOW = ['#ff9fd6', '#ffc7a0', '#fff3b0', '#b8ffe9', '#b5d8ff', '#d9b8ff'];

// soft light shaft material (Lagoon sun rays, Petalwood sunbeams)
const rayMats = {};
function rayMat(color) {
  return rayMats[color] || (rayMats[color] = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; varying float vPh; void main() { vUv = uv; vPh = instanceMatrix[3].x; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vPh; void main() { float a = pow(vUv.y, 1.6) * (1.0 - abs(vUv.x - 0.5) * 2.0) * (0.55 + 0.45 * sin(uTime * 0.7 + vPh)); gl_FragColor = vec4(uColor * a * 0.55, a); }',
  }));
}

export function makeKit(id, seed) {
  const R = rng(seed), batch = new Batch(), group = new THREE.Group(); group.name = id;
  const solids = [], colliders = [], occluders = [], interactables = [], npcs = [], animated = [], drifters = [], portals = [], lowHide = [];
  const colGroup = new THREE.Group(); colGroup.visible = false; group.add(colGroup);
  let circle = null, pathN = 0;

  // ---------- basics ----------
  // o = { r: [x,y,z] rotation, s: [x,y,z] scale, ink: outline }
  const add = (geo, mat, pos, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); if (o.r) m.rotation.set(...o.r); if (o.s) { if (typeof o.s === 'number') m.scale.setScalar(o.s); else m.scale.set(...o.s); } if (o.ink) outline(m); group.add(m); return m; };
  const twin = (mesh) => { mesh.updateMatrixWorld(true); const t = new THREE.Mesh(mesh.geometry, COL); t.applyMatrix4(mesh.matrixWorld); colGroup.add(t); t.updateMatrixWorld(true); return t; };
  // register a mesh as solid ground (a hidden double-sided twin is what the rays actually hit)
  function solid(mesh, cameraBlocks = true) { const t = twin(mesh); solids.push(t); if (cameraBlocks) occluders.push(t); return mesh; }
  const occlude = (mesh) => { occluders.push(twin(mesh)); return mesh; };            // blocks the camera only
  // push-out collider: a segment (ax,az)-(bx,bz) with radius r, active between heights y0..y1
  const wall = (ax, az, bx, bz, r, y0, y1) => colliders.push({ ax, az, bx, bz, r, y0, y1 });
  const post = (x, z, r, y0, y1) => wall(x, z, x, z, r, y0, y1);
  const shadow = (x, y, z, r) => batch.add('blob', G.blob, blobMat, V(x, y + 0.035, z), { scale: [r, 1, r] });
  // a ring of wall segments you cannot cross (zone borders); gaps = [[angle, halfWidth], …]
  function boundary(cx, cz, r, y0, y1, n = 40) {
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, b = (i + 1) / n * 6.283; wall(cx + Math.cos(a) * r, cz + Math.sin(a) * r, cx + Math.cos(b) * r, cz + Math.sin(b) * r, 0.5, y0, y1); }
  }

  // ---------- ground ----------
  // flat walkable disc with a top at height cy (used for seabeds, snowfields, forest floors)
  function floor(cx, cy, cz, r, mat, seg = 40) { return solid(add(new THREE.CylinderGeometry(r, r, 1, seg), mat, V(cx, cy - 0.5, cz))); }
  // floating island: walkable top, crystal keel, cloud rim.  o = { top, cliff, keel, rim: colour|false, sheen, tips }
  function island(cx, cy, cz, r, o = {}) {
    solid(add(new THREE.CylinderGeometry(r, r * 0.9, 1.1, 30), o.topMat || toon(o.top || THEME.grass), V(cx, cy - 0.55, cz)));
    add(new THREE.CylinderGeometry(r * 0.9, r * 0.62, r * 0.32, 12), toon(o.cliff || THEME.cliff), V(cx, cy - 1.1 - r * 0.16, cz));
    add(new THREE.ConeGeometry(r * 0.62, r * 0.75, 9).rotateX(Math.PI), toon(o.keel || THEME.keel), V(cx, cy - 1.1 - r * 0.32 - r * 0.375, cz));
    if (o.tips !== false) for (let i = 0; i < 5; i++) { const a = R() * 6.28, d = R() * r * 0.45; batch.add('keelTip', G.keelTip, holo(), V(cx + Math.cos(a) * d, cy - 1.4 - r * 0.5 - R() * r * 0.2, cz + Math.sin(a) * d), { scale: 0.7 + R() * r * 0.06 }); }
    if (o.rim !== false) { const n = Math.round(r * 1.5); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R() * 0.2, s = 1.5 + R() * 1.4; batch.add('puff' + (o.rim || ''), G.puff, toon(o.rim || THEME.cloud), V(cx + Math.cos(a) * (r + 0.4), cy - 0.9 - R() * 0.5, cz + Math.sin(a) * (r + 0.4)), { scale: [s, s * 0.72, s], rotY: R() * 6 }); } }
    if (o.sheen !== false) sheen(cx, cy, cz, r * 0.9, r * 1.2);
    return { cx, cy, cz, r };
  }
  // faint iridescent patches on the ground
  function sheen(cx, cy, cz, r, n, opacity = 0.16) {
    const mat = flat('#ffffff', { transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * r; batch.add('sheen' + opacity, G.blob, mat, V(cx + Math.cos(a) * d, cy + 0.02, cz + Math.sin(a) * d), { scale: [1.2 + R() * 2, 1, 0.8 + R() * 1.4], rotY: R() * 3, color: THEME.holo[i % 5] }); }
  }
  // raised round platform with straight (unclimbable) sides.  o = { side, top }
  function mesa(cx, cy, cz, r, h, o = {}) {
    add(new THREE.CylinderGeometry(r, r + 0.45, h, 28), toon(o.side || THEME.cliff), V(cx, cy + h / 2, cz));
    add(new THREE.CylinderGeometry(r, r, 0.05, 28), o.topMat || toon(o.top || THEME.grass), V(cx, cy + h + 0.03, cz));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28)); c.position.set(cx, cy + h / 2, cz); group.add(c); c.visible = false; solid(c);
  }
  // box you can stand on (platforms, steps, decks)
  const slab = (x, y, z, w, h, d, mat, o = {}) => solid(add(new THREE.BoxGeometry(w, h, d), mat, V(x, y + h / 2, z), o), o.camera !== false);
  // n steps climbing from (x, y, z) in direction yaw (0 = +Z).  o = { w, rise, run, cols, landing }
  function stairs(x, y, z, yaw, n, o = {}) {
    const w = o.w || 3.4, rise = o.rise || 0.3, run = o.run || 0.7, cols = o.cols || ['#ffe3f4', '#fff4fb'], dx = Math.sin(yaw), dz = Math.cos(yaw);
    for (let i = 0; i < n; i++) { const h = rise * (i + 1), d = i * run + run / 2; solid(add(new THREE.BoxGeometry(w - (i % 2) * 0.03, h, run + 0.04), toon(cols[i % 2]), V(x + dx * d, y + h / 2, z + dz * d), { r: [0, yaw, 0] })); }
    if (o.landing) { const d = n * run + o.landing / 2 - 0.1; solid(add(new THREE.BoxGeometry(w - 0.06, rise * n, o.landing), toon(cols[1]), V(x + dx * d, y + rise * n / 2, z + dz * d), { r: [0, yaw, 0] })); }
    const L = n * run + (o.landing || 0);
    for (const s of [-1, 1]) wall(x + dz * s * (w / 2 + 0.15), z - dx * s * (w / 2 + 0.15), x + dz * s * (w / 2 + 0.15) + dx * L, z - dx * s * (w / 2 + 0.15) + dz * L, 0.12, y, y + rise * n + 1.6);
    return rise * n;
  }
  // solid wedge rising h over len from (x, y, z) in direction yaw
  function ramp(x, y, z, yaw, len, h, w, color) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, h); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2);
    return solid(add(geo, toon(color), V(x, y, z), { r: [0, yaw - Math.PI / 2, 0] }));
  }
  // plank bridge along an arch from a to b.  o = { n, width, cols, rail, ball, rope }
  function bridge(a, b, arch, o = {}) {
    const n = o.n || 12, width = o.width || 2.8, cols = o.cols || RAINBOW;
    const pt = (u) => V(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * arch, a.z + (b.z - a.z) * u);
    const dir = V(b.x - a.x, 0, b.z - a.z).normalize(), side = V(-dir.z, 0, dir.x);
    for (let i = 0; i < n; i++) {
      const p0 = pt(i / n), p1 = pt((i + 1) / n), mid = p0.clone().lerp(p1, 0.5), len = p0.distanceTo(p1) + 0.12, dip = i % 2 ? 0.014 : 0;   // alternate planks sit a hair lower so overlapping ends never z-fight
      const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, len), toon(cols[i % cols.length])); plank.position.copy(mid).y -= 0.11 + dip; plank.lookAt(p1.clone().setY(p1.y - 0.11 - dip)); group.add(plank); solid(plank);
      for (const s of [-1, 1]) {
        const e0 = p0.clone().addScaledVector(side, s * (width / 2 - 0.1)), e1 = p1.clone().addScaledVector(side, s * (width / 2 - 0.1));
        batch.add('ropePost' + (o.rail || ''), G.ropePost, toon(o.rail || THEME.pearl), V(e0.x, e0.y + 0.5, e0.z));
        batch.add('ropeBall' + (o.ball || ''), G.sphere, toon(o.ball || THEME.gold), V(e0.x, e0.y + 1.05, e0.z), { scale: 0.11 });
        batch.add('rope' + (o.rope || ''), new THREE.BoxGeometry(0.05, 0.05, 1), toon(o.rope || '#ffd6f0'), e0.clone().lerp(e1, 0.5).setY((e0.y + e1.y) / 2 + 0.85), { lookAt: V(e1.x, e1.y + 0.85, e1.z), scale: [1, 1, e0.distanceTo(e1)] });
        wall(e0.x, e0.z, e1.x, e1.z, 0.13, Math.min(e0.y, e1.y) - 1, Math.max(e0.y, e1.y) + 1.4);
      }
    }
  }

  // ---------- props ----------
  const keepOut = [];                                                                // [x, z, r] areas scattered props must avoid
  const free = (x, z, r) => !keepOut.some((k) => Math.hypot(x - k[0], z - k[1]) < k[2] + r);
  const inDisc = (cx, cz, rMin, rMax) => { const a = R() * 6.283, d = rMin + Math.sqrt(R()) * (rMax - rMin); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };

  function tree(x, y, z, s, col, trunk = '#b08ac0') {
    batch.add('trunk' + trunk, G.trunk, toon(trunk), V(x, y + 0.85 * s, z), { scale: s });
    for (const [ox, oy, oz, r] of [[-0.55, 2.0, 0.1, 0.9], [0.6, 2.1, -0.2, 0.95], [0, 2.75, 0.05, 1.05], [0.1, 2.1, 0.6, 0.8]]) batch.add('canopy', G.puff, toon('#ffffff'), V(x + ox * s, y + oy * s, z + oz * s), { scale: r * s, rotY: R() * 6, color: col });
    post(x, z, 0.32 * s, y, y + 3); shadow(x, y, z, 1.5 * s); keepOut.push([x, z, 1.2]);
  }
  function pine(x, y, z, s, snow = true) {
    batch.add('pineTrunk', G.trunk, toon('#7a5a66'), V(x, y + 0.4 * s, z), { scale: [s, 0.5 * s, s] });
    for (let i = 0; i < 3; i++) { const r = (1.25 - i * 0.32) * s, h = 1.5 * s, cy = y + (0.8 + i * 0.85) * s + h / 2; batch.add('pine', G.cone, toon('#ffffff'), V(x, cy, z), { scale: [r, h, r], rotY: R() * 3, color: i % 2 ? '#4f957f' : '#3f8270' });
      if (snow) batch.add('pineSnow', G.cone, toon('#f4f8ff'), V(x, cy + h * 0.27, z), { scale: [r * 0.5, h * 0.48, r * 0.5] }); }
    post(x, z, 0.4 * s, y, y + 3); shadow(x, y, z, 1.3 * s); keepOut.push([x, z, 1.1 * s]);
  }
  function crystal(x, y, z, s) {
    for (const [ox, oz, h, k] of [[0, 0, 1.5, 1], [0.38, 0.1, 0.9, 0.7], [-0.3, 0.22, 0.7, 0.6]]) {
      batch.add('crystalBase', G.crystalBase, holo(), V(x + ox * s, y + 0.25 * s * h, z + oz * s), { scale: [k * s, s * h, k * s], rotY: R() * 3 });
      batch.add('crystal', G.crystal, holo(), V(x + ox * s, y + (0.5 * h + 0.3 * k) * s, z + oz * s), { scale: [k * s, 0.6 * k * s, k * s], rotY: R() * 3 });
    }
    post(x, z, 0.5 * s, y, y + 2); shadow(x, y, z, 0.9 * s); keepOut.push([x, z, 0.9]);
  }
  // glowing lamp.  o = { post, color, glow, size, kind: 'star' | 'lantern' }
  function lamp(x, y, z, o = {}) {
    const col = o.color || THEME.gold, gl = o.glow || '#ffe9a0';
    batch.add('lampPost' + (o.post || ''), G.lampPost, toon(o.post || '#d5dcf7'), V(x, y + 0.95, z));
    const s = o.kind === 'lantern' ? add(G.box, flat(col), V(x, y + 2.08, z), { s: [0.3, 0.38, 0.3], ink: true }) : add(G.star, toon(col, { emissive: col, emissiveIntensity: 0.6 }), V(x, y + 2.15, z), { s: [0.8, 1.1, 0.8], ink: true });
    if (o.kind === 'lantern') add(G.cone, toon(o.post || '#5d6aa8'), V(x, y + 2.37, z), { s: [0.28, 0.2, 0.28] });
    const g = glow(gl, o.size || 1.5, 0.5); g.position.set(x, y + 2.12, z); group.add(g);
    animated.push((dt, t) => { if (o.kind !== 'lantern') s.rotation.y = t * 0.8 + x; g.material.opacity = 0.42 + 0.14 * Math.sin(t * 3 + x * 2); });
    post(x, z, 0.14, y, y + 2.3); keepOut.push([x, z, 0.5]);
  }
  // stepping-stone path through [x, y, z] points; every stone gets its own tiny height so overlaps never z-fight
  function path(points, base = '#fff4fb', accents = THEME.holo, size = 0.75) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0, z0] = points[i], [x1, y1, z1] = points[i + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (1.65 * size));
      for (let k = 0; k < n; k++) { const u = k / n, x = x0 + (x1 - x0) * u + (R() - 0.5) * 0.3, z = z0 + (z1 - z0) * u + (R() - 0.5) * 0.3;
        batch.add('path', G.disc, toon('#ffffff'), V(x, y0 + (y1 - y0) * u + 0.03 + (pathN++ % 9) * 0.007, z), { scale: [size + R() * 0.25, 1, size + R() * 0.25], rotY: R() * 3, color: k % 3 ? base : accents[k % accents.length] });
        keepOut.push([x, z, 0.9]); }
    }
  }
  // flowers + grass tufts scattered in a disc.  o = { stem, tuft, cols, tufts: 0..1 }
  function flowers(cx, cy, cz, r, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const [x, z] = inDisc(cx, cz, 0.5, r); if (!free(x, z, 0.25)) continue;
      const h = 0.3 + R() * 0.25, col = (o.cols || THEME.holo)[(R() * (o.cols ? o.cols.length : 4)) | 0];
      if (R() > (o.tufts == null ? 0.4 : o.tufts)) { batch.add('stem', G.stem, toon(o.stem || '#7fd6a4'), V(x, cy + h / 2, z), { scale: [1, h / 0.4, 1] }); batch.add('petal', G.petal, toon('#ffffff'), V(x, cy + h + 0.06, z), { scale: [1, 0.7, 1], rotY: R() * 6, color: col }); batch.add('pollen', G.petal, toon('#fff3a8'), V(x, cy + h + 0.12, z), { scale: 0.4 }); }
      else batch.add('tuft', G.tuft, toon('#ffffff'), V(x, cy + 0.15, z), { scale: 0.8 + R() * 0.8, rotY: R() * 6, color: o.tuft || '#9be6cc' });
    }
  }
  // lumpy cloud / snowdrift / bush you walk around
  function clump(x, y, z, s, color = THEME.cloud) {
    for (const [ox, oy, oz, r] of [[-0.7, 0.45, 0, 0.7], [0.6, 0.5, 0.1, 0.8], [0, 0.85, 0, 0.9]]) batch.add('clump' + color, G.puff, toon(color), V(x + ox * s, y + oy * s, z + oz * s), { scale: r * s });
    post(x, z, 1.05 * s, y, y + 1.6); shadow(x, y, z, 1.5 * s); keepOut.push([x, z, 1.6 * s]);
  }
  function rock(x, y, z, s, color = '#b9a8e0') {
    batch.add('rock' + color, G.rock, toon(color), V(x, y + s * 0.45, z), { scale: [s, s * 0.8, s * 0.9], rotY: R() * 6, rotX: R() * 0.4 });
    post(x, z, s * 0.85, y, y + s * 1.4); shadow(x, y, z, s * 1.2); keepOut.push([x, z, s * 1.1]);
  }
  // slanted shafts of light
  function rays(list, color) { const m = rayMat(color); for (const [x, y, z, w, h] of list) for (const ry of [0, 1.57]) batch.add('ray' + color, G.plane, m, V(x, y + h / 2, z), { scale: [w, h, 1], rotY: ry + R() * 0.5, rotZ: 0.22 }); lowHide.push('ray' + color); }

  // ---------- Study Circle ----------
  // ring of cushions; returns the seat list for setCircle
  function seats(cx, y, cz, r, n, cols = THEME.holo, a0 = 0.52, kind = 'cushion') {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + a0, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (kind === 'mushroom') { add(G.cyl, toon('#fff6ea'), V(x, y + 0.12, z), { s: [0.16, 0.24, 0.16] }); add(G.dome, toon(cols[i % cols.length]), V(x, y + 0.2, z), { s: [0.46, 0.2, 0.46], ink: true }); }
      else add(G.cushion, toon(cols[i % cols.length]), V(x, y + 0.1, z), { s: [0.48, 0.15, 0.48], ink: true });
      out.push({ x, z, top: y + (kind === 'mushroom' ? 0.4 : 0.25) });         // top = the surface you sit ON
    }
    return out;
  }
  const setCircle = (c) => { circle = Object.assign({ id }, c); };              // { name, x, z, y, r, seats, label: Vector3 }

  // ---------- portals: one glowing gate per other realm, in a row facing `yaw` ----------
  function gates(cx, y, cz, yaw, spread = 4.4) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    ZONE_ORDER.filter((z) => z !== id).forEach((to, i) => {
      const off = (i - 1.5) * spread, back = Math.abs(i - 1.5) * 0.9, x = cx + rx * off + fx * back, z = cz + rz * off + fz * back, acc = ZONES[to].accent;
      add(new THREE.TorusGeometry(1.2, 0.15, 8, 22, Math.PI), holo(), V(x, y + 0.9, z), { r: [0, yaw, 0], ink: true });
      for (const s of [-1, 1]) { add(G.cyl, holo(), V(x + rx * s * 1.2, y + 0.45, z + rz * s * 1.2), { s: [0.15, 0.9, 0.15], ink: true }); post(x + rx * s * 1.2, z + rz * s * 1.2, 0.2, y, y + 2.4); }
      const veil = add(new THREE.CircleGeometry(1.1, 20), flat(acc, { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }), V(x, y + 1.0, z), { r: [0, yaw, 0], s: [1, 1.05, 1] });
      const g = glow(acc, 3.0, 0.4); g.position.set(x, y + 1.1, z); group.add(g);
      const star = add(G.star, toon(acc, { emissive: acc, emissiveIntensity: 0.7 }), V(x, y + 2.45, z), { s: [0.9, 1.3, 0.9], ink: true });
      add(G.disc, toon(THEME.pearl), V(x, y + 0.03 + i * 0.006, z), { s: [1.5, 1, 1.5] });
      animated.push((dt, t) => { veil.material.opacity = 0.34 + 0.12 * Math.sin(t * 2 + i); star.rotation.y = t + i; g.material.opacity = 0.32 + 0.1 * Math.sin(t * 2.4 + i); });
      portals.push({ to, pos: V(x, y, z), r: 0.95, tag: V(x, y + 3.0, z) }); keepOut.push([x, z, 2]);
    });
  }

  // ---------- NPCs + interactables ----------
  function npc(name, maker, home, range, lines, speed = 1.1) {
    const m = maker(); group.add(m.group); m.group.position.copy(home);
    const blob = new THREE.Mesh(G.blob, blobMat); blob.scale.setScalar(0.45); blob.position.y = 0.04; m.group.add(blob);
    const n = { name, m, home, range, lines, line: 0, pos: home.clone(), target: home.clone(), wait: 1 + R() * 3, moving: false, speed, height: m.height };
    npcs.push(n);
    interactables.push({ pos: n.pos, r: 2.6, label: 'Talk to ' + name.split(' ')[0], height: n.height, npc: n, use() { n.line = (n.line + 1) % lines.length; return lines[(n.line + lines.length - 1) % lines.length]; } });
    return n;
  }
  const person = (kind, scheme, skin) => () => makeAvatar({ kind, scheme, skin });
  const animal = (type, scale, color) => () => makePet(type, scale, color);
  // o = { pos, r, label, height, tag: Vector3, use(it) → text }
  const thing = (o) => interactables.push(o);

  // ---------- drifting creatures: 'butterfly' | 'jelly' | 'fairy' ----------
  const wingGeo = new THREE.CircleGeometry(0.12, 6); wingGeo.translate(0.11, 0, 0);
  function drift(kind, n, cx, cy, cz, r, spreadY = 1.2) {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(), [x, z] = inDisc(cx, cz, 1, r), d = { kind, g, home: V(x, cy + R() * spreadY, z), ph: R() * 6, trail: 0 };
      if (kind === 'jelly') {
        const bell = new THREE.Mesh(G.dome, holo(0.82, true)); bell.scale.set(0.42, 0.36, 0.42); g.add(bell); d.bell = bell;
        for (let k = 0; k < 4; k++) { const tn = new THREE.Mesh(G.cyl, flat(k % 2 ? '#ffffff' : THEME.holo[i % 5], { transparent: true, opacity: 0.8 })); tn.scale.set(0.02, 0.6, 0.02); tn.position.set((k - 1.5) * 0.13, -0.3, (k % 2 - 0.5) * 0.16); g.add(tn); }
        const gl = glow(i % 2 ? '#ffb3e6' : '#b5d8ff', 1.7, 0.45); g.add(gl); d.speed = 0.45; d.range = 6;
      } else if (kind === 'fairy') {
        g.add(new THREE.Mesh(G.sphere, flat('#fffbe0')).translateY(0)); g.children[0].scale.setScalar(0.07);
        const mat = flat('#ffffff', { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }); d.l = new THREE.Mesh(wingGeo, mat); d.r = new THREE.Mesh(wingGeo, mat); d.r.scale.x = -1; g.add(d.l, d.r);
        g.add(glow(THEME.holo[i % 5], 1.1, 0.75)); d.speed = 2.3; d.range = 9;
      } else {
        const mat = flat(THEME.holo[i % 5], { side: THREE.DoubleSide }); d.l = new THREE.Mesh(wingGeo, mat); d.r = new THREE.Mesh(wingGeo, mat); d.r.scale.x = -1; g.add(d.l, d.r); d.speed = 1.5; d.range = 7;
      }
      d.pos = d.home.clone(); d.target = d.home.clone(); g.position.copy(d.pos); group.add(g); drifters.push(d);
    }
  }

  // ============================================================
  //  finish(): bake the instanced props and return the zone
  // ============================================================
  function finish(o) {
    const instanced = batch.build(group);
    const ray = new THREE.Raycaster(), DOWN = V(0, -1, 0), origin = V(0, 0, 0), hits = [], tmp = V(0, 0, 0);
    function ground(x, y, z) {
      origin.set(x, y + 40, z); ray.set(origin, DOWN); ray.far = 60; hits.length = 0;
      ray.intersectObjects(solids, false, hits);
      let best = null; const tops = new Map(), bots = new Map();
      for (const h of hits) { const ob = h.object, py = h.point.y; if (!tops.has(ob) || py > tops.get(ob)) tops.set(ob, py); if (!bots.has(ob) || py < bots.get(ob)) bots.set(ob, py); }
      for (const [ob, top] of tops) {
        if (top <= y + STEP) { if (best === null || top > best) best = top; }
        else if (bots.get(ob) < y + BODY) return null;                                // a solid overlaps your body: wall or cliff
      }
      return best !== null && best >= y - DROP ? best : null;                        // nothing close below: an edge
    }
    let low = false;
    // ctx = { playerPos, trail(pos) }
    function update(dt, t, ctx) {
      for (const f of animated) f(dt, t);
      if (!low) for (const b of drifters) {
        if (b.pos.distanceTo(b.target) < 0.3) b.target.set(b.home.x + (Math.random() - 0.5) * b.range, b.home.y + (Math.random() - 0.5) * 1.2, b.home.z + (Math.random() - 0.5) * b.range);
        tmp.subVectors(b.target, b.pos).normalize(); b.pos.addScaledVector(tmp, dt * b.speed); b.pos.y += Math.sin(t * (b.kind === 'jelly' ? 1.4 : 6) + b.ph) * dt * (b.kind === 'jelly' ? 0.25 : 0.5);
        b.g.position.copy(b.pos);
        if (b.kind === 'jelly') { const p = Math.sin(t * 2.4 + b.ph); b.bell.scale.set(0.42 + p * 0.05, 0.36 - p * 0.04, 0.42 + p * 0.05); }
        else { b.g.rotation.y = Math.atan2(tmp.x, tmp.z); const fl = Math.sin(t * (b.kind === 'fairy' ? 24 : 16) + b.ph) * 1.1; b.l.rotation.y = fl; b.r.rotation.y = -fl;
          if (b.kind === 'fairy' && (b.trail += dt) > 0.07) { b.trail = 0; ctx.trail(b.pos); } }
      }
      // NPCs: stroll to a nearby point, pause, repeat; turn to face a player who comes close
      for (const n of npcs) {
        const near = ctx.playerPos && n.pos.distanceTo(ctx.playerPos) < 3.2;
        if (near) { n.moving = false; n.m.group.rotation.y = lerpAngle(n.m.group.rotation.y, Math.atan2(ctx.playerPos.x - n.pos.x, ctx.playerPos.z - n.pos.z), dt * 5); }
        else if (n.moving) {
          tmp.subVectors(n.target, n.pos); tmp.y = 0; const d = tmp.length();
          if (d < 0.15) { n.moving = false; n.wait = 2 + Math.random() * 4; }
          else { tmp.normalize(); const nx = n.pos.x + tmp.x * dt * n.speed, nz = n.pos.z + tmp.z * dt * n.speed, gy = ground(nx, n.pos.y, nz);
            if (gy === null) { n.moving = false; n.wait = 1; } else { n.pos.set(nx, gy, nz); n.m.group.rotation.y = lerpAngle(n.m.group.rotation.y, Math.atan2(tmp.x, tmp.z), dt * 6); } }
        } else if ((n.wait -= dt) <= 0) { n.target.set(n.home.x + (Math.random() - 0.5) * 2 * n.range, n.home.y, n.home.z + (Math.random() - 0.5) * 2 * n.range); n.moving = true; }
        n.m.group.position.copy(n.pos); n.m.update(dt, { move: n.moving ? 1 : 0, sit: false });
      }
    }
    function setLow(v) {
      low = v; for (const b of drifters) b.g.visible = !v;
      for (const k in instanced) if (/^(sheen|tuft|pollen)/.test(k) || lowHide.includes(k)) instanced[k].visible = !v;
    }
    for (const it of interactables) it.zone = id;
    return Object.assign({ id, name: ZONES[id].name, group, solids, ground, colliders, occluders, circle, interactables, npcs, portals, update, setLow, spawnYaw: Math.PI }, o);
  }

  return { id, R, G, group, batch, animated, keepOut, free, inDisc, add, solid, occlude, wall, post, shadow, boundary, floor, island, sheen, mesa, slab, stairs, ramp, bridge,
    tree, pine, crystal, lamp, path, flowers, clump, rock, rays, seats, setCircle, gates, npc, person, animal, thing, drift, finish, lowHide };
}
