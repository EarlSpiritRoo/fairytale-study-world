/* Skyfield: floating islands at four heights. The main island with the gazebo plateau (the Sky Gazebo
   Study Circle); behind the gazebo, the rainbow bridge to the castle isle and THE OPAL SPIRE, a floating
   opal-glass castle wrapped in slowly turning gold rings. Inside: a great hall, a spiral staircase up to a
   balcony over the waterfalls, and the Starlight Library (a second Study Circle). Waterfalls pour off the
   balcony and the island edges into a cloud lagoon far below. East: the pegasus stable isle (pegasi land and
   idle there), then the Lookout up the cloud steps. West: the Crystal Isle.

   The look: cotton candy clouds. A white / pearl cloud ground scattered with puffs under a bright
   pink-lilac sky, with fixed daylight (no day / evening cycle). */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, flat, opal, THEME } from '../toon.js';
import { makePet } from '../character.js';
import { calmWaterMat, rainbowMat, starCeilMat } from '../surfaces.js';

const LOOK = { ground: { top: '#fffafd', cliff: '#f4e6ff', keel: '#e2cbff' }, castleGround: { top: '#fffafd', cliff: '#f4e6ff', keel: '#e2cbff' }, puffs: 110,
    flowers: ['#ffc2e4', '#ffd9f2', '#e9d4ff', '#fff3b0'], trees: ['#ffc2e4', '#ffd6f0', '#efd8ff', '#ffe3f4'],
    env: { sky: { day: ['#f7a6da', '#e6c9ff', '#fff1fb'], eve: ['#b98ae8', '#ff9fd2', '#ffd8ea'] }, cycle: false, clouds: true, flyers: true,
      fog: { day: '#fbe8ff', eve: '#ffd0e8', near: 40, far: 210 }, hemi: ['#ffffff', '#ffe2f4', 1.6, '#ffc8e6'], sun: ['#fff2fa', 1.65, '#ffc6dc'] } };

export function build() {
  const K = makeKit('skyfield', 20261117), { R, G, add, solid, post, wall, batch, animated } = K;
  const L = LOOK, GROUND = L.ground;
  K.island(0, 0, 0, 24, Object.assign({ gaps: [[-1.127, 0.2], [-2.015, 0.2]] }, GROUND));      // (cloud rim open where waterfalls pour off)
  K.island(40, 3, 2, 9, GROUND); K.island(49, 7.4, -16, 5, GROUND); K.island(-38, -2.6, -3, 8.5, GROUND);   // stable isle, Lookout, Crystal Isle
  const CY = 3, CZ = -46;                                                  // castle isle: top height, centre z
  K.island(0, CY, CZ, 19, Object.assign({ gaps: [[-0.852, 0.24], [-2.289, 0.24], [1.065, 0.22], [2.076, 0.22], [-1.571, 0.26]] }, L.castleGround));
  const OPAL = opal('#f6e6ff'), OPAL_GLOW = opal('#ffeef8', 0.16), GOLD = toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.35 });
  const WIN = flat('#ffe6a8'), PEARL = toon(THEME.pearl);
  // box spanning [x0,x1] x [y0,y1] x [z0,z1]; o = { occ: blocks the camera, solid: walkable, ink }
  // Static opal walls are MERGED into one mesh (one draw call); each keeps a hidden copy for the camera / collisions.
  const opalGeos = [];
  const box = (x0, x1, y0, y1, z0, z1, mat, o = {}) => {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), c = V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    let m;
    if (mat === OPAL && !o.solid) { opalGeos.push(geo.clone().translate(c.x, c.y, c.z)); m = new THREE.Mesh(geo); m.position.copy(c); }
    else m = add(geo, mat, c, { ink: o.ink });
    if (o.solid) solid(m, o.occ !== false); else if (o.occ !== false) K.occlude(m);
    return m;
  };
  const mergeGeos = (list) => {
    let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
    for (const g of list) { pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
      const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx[io + k] = ix[k] + vo; vo += g.attributes.position.count; io += ix.length; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere(); return g;
  };
  // a few moving things drawn as ONE InstancedMesh each, updated every frame
  const movingSet = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; K.group.add(im); return im; };
  const tmpO = new THREE.Object3D();
  // a hidden collision box (the visible part is instanced)
  const hiddenSolid = (geo, pos, rotY = 0) => { const m = new THREE.Mesh(geo); m.position.copy(pos); m.rotation.y = rotY; solid(m, false); };
  const garden = (cx, cy, cz, n, r) => { for (let i = 0, k = 0; k < n && i < 80; i++) { const [x, z] = K.inDisc(cx, cz, 0, r); if (K.free(x, z, 0.9)) { K.crystal(x, cy, z, 0.6 + R() * 0.9); k++; } } K.sheen(cx, cy, cz, r + 1, 6, 0.22); };

  // ----- plateau, stairs, ramp -----
  const PX = 0, PZ = -6, PH = 2.4, GY = PH + 0.25;
  K.mesa(PX, 0, PZ, 8.5, PH);
  for (let i = 0; i < 30; i++) {                         // pearl fence around the rim, open at the stairs and the ramp
    const a = i / 30 * 6.283, x = PX + Math.cos(a) * 8.15, z = PZ + Math.sin(a) * 8.15;
    if (Math.abs(a - Math.PI / 2) < 0.26 || Math.abs(a - Math.PI * 1.5) < 0.24 || a < 0.2 || a > 6.08) continue;   // (north: the bridge to the castle)
    batch.add('fence', G.fence, toon(THEME.pearl), V(x, PH + 0.3, z)); batch.add('fenceTop', G.sphere, toon('#ffffff'), V(x, PH + 0.66, z), { scale: 0.11, color: THEME.holo[i % 5] });
  }
  K.stairs(0, 0, 8.5, Math.PI, 8, { landing: 1.3 });
  K.ramp(13.6, 0, PZ, -Math.PI / 2, 5.6, PH, 2.8, '#ffe9f6');

  // ----- the gazebo (Study Circle) -----
  solid(add(new THREE.CylinderGeometry(4.6, 4.8, 0.25, 28), toon(THEME.pearl), V(PX, PH + 0.125, PZ), { ink: true }));
  add(new THREE.CylinderGeometry(3.3, 3.3, 0.02, 28), holo(0.55), V(PX, GY + 0.03, PZ));
  const cols = [], colGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.1, 10), ringGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 10);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * 6.283, x = PX + Math.cos(a) * 4.1, z = PZ + Math.sin(a) * 4.1; cols.push([x, z]);
    batch.add('column', colGeo, toon(THEME.pearl), V(x, GY + 1.55, z));
    batch.add('colRing', ringGeo, toon('#d9c6ff'), V(x, GY + 0.08, z)); batch.add('colRing', ringGeo, null, V(x, GY + 3.05, z));
    post(x, z, 0.3, PH, GY + 3.2);
  }
  const railGeo = new THREE.BoxGeometry(0.16, 0.7, 3.0), railTop = new THREE.BoxGeometry(0.26, 0.08, 3.1);
  for (let i = 0; i < 8; i++) {                          // low walls between columns; the south and north spans stay open as doorways
    const a = cols[i], b = cols[(i + 1) % 8], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (Math.abs(mx - PX) < 1 && Math.abs(Math.abs(mz - PZ) - 3.8) < 0.5) continue;
    batch.add('rail', railGeo, toon('#ffe3f4'), V(mx, GY + 0.35, mz), { lookAt: V(b[0], GY + 0.35, b[1]) });
    batch.add('railTop', railTop, toon(THEME.pearl), V(mx, GY + 0.74, mz), { lookAt: V(b[0], GY + 0.74, b[1]) });
    wall(a[0], a[1], b[0], b[1], 0.14, PH, GY + 1.2);
  }
  K.occlude(add(new THREE.SphereGeometry(5.1, 24, 10, 0, 6.283, 0, Math.PI / 2), holo(1, true), V(PX, GY + 3.1, PZ), { s: [1, 0.6, 1] }));   // the roof blocks the camera, not your feet
  add(new THREE.TorusGeometry(5.05, 0.16, 6, 32), toon(THEME.pearl), V(PX, GY + 3.12, PZ), { r: [Math.PI / 2, 0, 0], ink: true });
  const finial = add(G.star, toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.6 }), V(PX, GY + 6.75, PZ), { s: [1.6, 2.2, 1.6], ink: true });
  const finialGlow = glow('#ffe9a0', 4); finialGlow.position.set(PX, GY + 6.75, PZ); K.group.add(finialGlow);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), toon(THEME.pearl), V(PX, GY + 6.3, PZ));
  add(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 10), toon('#d9c6ff'), V(PX, GY + 0.15, PZ), { ink: true }); post(PX, PZ, 0.55, PH, GY + 1.6);
  const studyStar = add(new THREE.OctahedronGeometry(0.38), holo(), V(PX, GY + 1.05, PZ), { ink: true });
  const starGlow = glow('#ffd6f5', 2.4, 0.6); starGlow.position.copy(studyStar.position); K.group.add(starGlow);
  for (let i = 0; i < 8; i++) {                          // hanging star charms
    const a = i / 8 * 6.283, s = add(G.star, toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.5 }), V(PX + Math.cos(a) * 4.5, GY + 2.5, PZ + Math.sin(a) * 4.5), { s: [0.55, 0.8, 0.55] });
    animated.push((dt, t) => { s.rotation.y = t + i; s.position.y = GY + 2.5 + Math.sin(t * 2 + i) * 0.06; });
  }
  animated.push((dt, t) => { studyStar.rotation.y = t * 0.9; studyStar.position.y = GY + 1.05 + Math.sin(t * 1.6) * 0.1; starGlow.position.y = studyStar.position.y; finial.rotation.y = t * 0.5; finialGlow.material.opacity = 0.6 + 0.2 * Math.sin(t * 2); });
  K.setCircle({ name: 'Sky Gazebo', x: PX, z: PZ, y: GY, r: 3.75, seats: K.seats(PX, GY, PZ, 2.45, 6), label: V(PX, GY + 5.6, PZ) });

  // ----- bridges and cloud steps -----
  K.bridge(V(0, PH - 0.015, PZ - 8.45), V(0, CY, -27.4), 1.6, { n: 16, width: 3.4 });            // plateau (behind the gazebo) → castle isle
  K.bridge(V(23.2, 0, 1.5), V(32.3, 3, 0.6), 1.1);                       // main → pegasus stable isle (climbs)
  K.bridge(V(-23.2, 0, -1.5), V(-30.3, -2.6, -2.6), 0.9, { n: 10 });     // main → Crystal Isle (descends)
  { const a = V(43.2, 3, -5.4), b = V(47.2, 7.4, -12.2), n = 10;         // overlapping pads, so there is always ground underfoot
    for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n);
      solid(add(new THREE.CylinderGeometry(0.95, 0.75, 0.34, 12), toon(i % 2 ? THEME.cloud : '#ffe9f8'), V(p.x, p.y + 0.03, p.z), { ink: true }), false);
      batch.add('stepPuff', G.puff, toon(THEME.cloud), V(p.x, p.y - 0.25, p.z), { scale: [0.9, 0.45, 0.9], rotY: i }); } }

  // ----- portals to the other realms, at the south rim -----
  K.gates(0, 0, 21.4, Math.PI, 4.3);

  // ----- props -----
  K.keepOut.push([PX, PZ, 10.4], [0, 13, 4.2], [18, 1.5, 6], [-18, -1.5, 6], [13, PZ, 4], [-12, 8, 3.4], [0, 20, 9]);
  K.path([[0, 0, 19], [0, 0, 8.8]]); K.path([[1.5, 0, 12], [12, 0, 6], [22.5, 0, 1.8]]); K.path([[-1.5, 0, 12], [-12, 0, 4], [-22.5, 0, -1.4]]); K.path([[13.5, 0, -6], [16, 0, -1], [14, 0, 4]]);
  K.path([[32.8, 3, 0.6], [39, 3, 0], [43, 3, -5]]); K.path([[-30.6, -2.6, -2.6], [-38, -2.6, -3]]); K.path([[0, PH, 1.9], [0, PH, -1.3]]);
  for (const [x, y, z] of [[-2.4, 0, 9.2], [2.4, 0, 9.2], [-2.6, 0, 15], [2.6, 0, 15], [21.5, 0, 4.4], [-21.5, 0, -4.4], [36, 3, 3.5], [-34, -2.6, 1], [-2.4, PH, 1.2], [2.4, PH, 1.2]]) K.lamp(x, y, z);
  const TREE = L.trees || ['#ffc2e4', '#ffd3ec', '#e6ccff', '#ffd9c2'];
  for (let i = 0, n = 0; n < 13 && i < 300; i++) { const [x, z] = K.inDisc(0, 0, 6, 21); if (K.free(x, z, 1.6)) { K.tree(x, 0, z, 0.9 + R() * 0.5, TREE[n % 4]); n++; } }
  for (let i = 0, n = 0; n < 7 && i < 200; i++) { const [x, z] = K.inDisc(0, 0, 5, 22); if (K.free(x, z, 1.2)) { K.crystal(x, 0, z, 0.8 + R() * 0.5); n++; } }
  K.tree(-41, -2.6, -7, 1.1, '#e6ccff');
  for (const [x, z, s] of [[-36, -6, 1.6], [-42, -1, 1.2], [-34, 1.5, 1.0], [-40, 2.2, 1.4], [-44, -5, 0.9]]) K.crystal(x, -2.6, z, s);
  K.crystal(51, 7.4, -18.6, 1.1); K.crystal(3.5, PH, -12.3, 0.8); K.crystal(-4, PH, -12, 0.7);
  for (const [x, y, z, s] of [[9, 0, 15, 1.3], [-8, 0, 16, 1.1], [17, 0, -9, 1.4], [-16, 0, -11, 1.5], [6, PH, -11.5, 0.8]]) K.clump(x, y, z, s);
  const FL = L.flowers ? { cols: L.flowers } : {};
  K.flowers(0, 0, 0, 22.8, 320, FL); K.flowers(40, 3, 2, 8, 50, FL); K.flowers(49, 7.4, -16, 4.2, 26, FL); K.flowers(-38, -2.6, -3, 7.5, 46, FL);
  if (L.puffs) for (const [cx, cy, cz, r, n] of [[0, 0, 0, 22.5, L.puffs], [40, 3, 2, 8, 18], [-38, -2.6, -3, 7.5, 14], [0, CY, CZ, 18, 30]]) for (let i = 0; i < n; i++) {   // cotton-candy cloud ground
    const [x, z] = K.inDisc(cx, cz, 2, r); if (!K.free(x, z, 0.5)) continue; const s = 0.35 + R() * 0.7;
    batch.add('groundPuff', G.puff, toon('#ffffff'), V(x, cy + s * 0.25, z), { scale: [s * 1.4, s * 0.55, s * 1.4], rotY: R() * 6, color: i % 4 ? '#ffffff' : i % 8 ? '#ffe6f4' : '#efe2ff' }); }

  // wishing pool, signpost, tea table, telescope
  const POOL = V(-12, 0, 8);
  add(new THREE.TorusGeometry(2.1, 0.32, 8, 22), toon(THEME.pearl), V(POOL.x, 0.2, POOL.z), { r: [Math.PI / 2, 0, 0], ink: true });
  add(new THREE.CircleGeometry(2.05, 28).rotateX(-Math.PI / 2), calmWaterMat({ deep: '#a8c4f0', shallow: '#d4ecff', sky: '#ffe2cf', light: [0.6, 0.25, -0.75], lightCol: '#fff0c8', centre: [POOL.x, POOL.z], radius: 2.2 }), V(POOL.x, 0.24, POOL.z)); post(POOL.x, POOL.z, 2.4, 0, 1.2);
  add(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6), toon('#b08ac0'), V(3.6, 0.8, 13.6), { ink: true });
  add(new THREE.BoxGeometry(1.3, 0.42, 0.1), toon(THEME.pearl), V(3.6, 1.45, 13.6), { r: [0, -0.4, 0], ink: true }); add(new THREE.BoxGeometry(1.1, 0.36, 0.1), toon('#ffe3f4'), V(3.6, 1.0, 13.6), { r: [0, 0.5, 0], ink: true }); post(3.6, 13.6, 0.35, 0, 2);
  add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 14), toon(THEME.pearl), V(36.5, 3.75, -3.4), { ink: true }); add(new THREE.CylinderGeometry(0.12, 0.3, 0.7, 8), toon('#d9c6ff'), V(36.5, 3.35, -3.4));
  add(G.sphere, toon('#ff9fd6'), V(36.5, 3.95, -3.4), { s: [0.22, 0.17, 0.22], ink: true }); for (const s of [-1, 1]) add(G.sphere, toon(THEME.holo[s + 2]), V(36.5 + s * 1.35, 3.25, -3.4), { s: [0.4, 0.25, 0.4], ink: true }); post(36.5, -3.4, 1.0, 3, 5);
  add(new THREE.CylinderGeometry(0.08, 0.14, 1.3, 6), toon('#d5dcf7'), V(51.6, 8.05, -14.6), { ink: true }); add(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 8), toon(THEME.gold), V(51.6, 8.9, -14.6), { r: [0, 0, 1.1], ink: true }); post(51.6, -14.6, 0.5, 7.4, 9.5);

  // ----- life -----
  K.drift('butterfly', 8, 0, 1, 0, 20); K.drift('butterfly', 2, 39, 4, 0, 5); K.drift('butterfly', 2, -38, -1.6, -3, 6);
  K.npc('Odette the Cloud Shepherd', K.person('princess', 3, 2), V(4.6, 0, 11.5), 2.2, ['Welcome to Skyfield, dear. The gazebo up those stairs is where we study together.', 'Step inside and stand still: you will sit, and the circle\'s timer finds you.', 'The glowing gates behind you lead to the other four realms.']);
  K.npc('Nimbus', K.animal('pegasus', 2.6), V(-38, -2.6, 0.5), 3.2, ['Nimbus snorts a very small rainbow.', 'Nimbus nudges your pocket, hoping for sugar stars.'], 1.4);
  K.npc('Featherwhistle', K.animal('pegasus', 2.2, '#ffeaf6'), V(47.5, 7.4, -17.5), 1.6, ['Featherwhistle is watching the clouds. She says the view is best after a full focus round.', 'A sleepy whinny. Even pegasi take breaks.'], 1);
  K.npc('Pemberly the Tea Fairy', K.person('fairy', 2, 0), V(37.8, 3, -1.6), 1.2, ['Tea is for breaks, darling. Earn it first.', 'Five minutes of rest tastes better after twenty-five of work.']);
  K.thing({ pos: V(3.6, 0, 13.6), r: 2.4, label: 'Read the signpost', height: 2, tag: V(3.6, 2, 13.6), use: (i) => ['Skyfield ✦ Gazebo: up the stairs · the Opal Spire: over the bridge behind the gazebo · Pegasus stable and Lookout: east bridge · Crystal Isle: west bridge', 'The gates at the south rim open onto the Lagoon, Hollyhollow, the Pavilion and Petalwood.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: POOL, r: 3.6, label: 'Make a wish', height: 1.2, tag: V(POOL.x, 1.6, POOL.z), fx: 26, use: () => 'You toss a wish into the pool. ✦' });
  K.thing({ pos: V(51.6, 7.4, -14.6), r: 2.4, label: 'Look through the telescope', height: 2, tag: V(51.6, 9.6, -14.6), use: () => 'Far below, four more realms glitter through the clouds.' });

  // =====================================================================
  //  THE OPAL SPIRE
  // =====================================================================
  // Great hall interior: x -7..7, z -38..-52, floor CY, ceiling CY + 10. Walls 0.6 thick.
  const HX = 7, HZ0 = -38, HZ1 = -52, HH = 10, T = 0.6, FY = CY;
  const top = FY + HH, BAL = FY + 4.5;                                     // balcony level
  // floor: polished opal tiles (1 cm above the island top, so no z-fighting)
  add(new THREE.BoxGeometry(HX * 2, 0.04, HZ0 - HZ1), toon('#e8dcff'), V(0, FY - 0.008, (HZ0 + HZ1) / 2));
  add(new THREE.BoxGeometry(3, 0.03, 11.6), toon('#ff9fcf'), V(0, FY + 0.02, -44.6)); add(new THREE.BoxGeometry(3.4, 0.02, 12), GOLD, V(0, FY + 0.012, -44.6));          // runner carpet from the door
  // south wall with the grand doorway (x -2..2, up to FY + 6)
  box(-HX - T / 2, -2, FY, top, HZ0 - T / 2, HZ0 + T / 2, OPAL, { ink: true }); box(2, HX + T / 2, FY, top, HZ0 - T / 2, HZ0 + T / 2, OPAL, { ink: true });
  box(-2, 2, FY + 6, top, HZ0 - T / 2, HZ0 + T / 2, OPAL, { ink: true });
  add(new THREE.TorusGeometry(2, 0.18, 8, 24, Math.PI), GOLD, V(0, FY + 6, HZ0 + T / 2 + 0.05), { ink: true });
  for (const s of [-1, 1]) add(G.cyl, GOLD, V(s * 2.05, FY + 3, HZ0 + T / 2 + 0.05), { s: [0.18, 6, 0.18], ink: true });
  wall(-HX, HZ0, -2, HZ0, T / 2 + 0.02, FY - 1, top); wall(2, HZ0, HX, HZ0, T / 2 + 0.02, FY - 1, top);
  // west wall with the archway to the library (z -46.5 .. -42.5, up to FY + 5)
  box(-HX - T / 2, -HX + T / 2, FY, top, -42.5, HZ0 + T / 2, OPAL);
  box(-HX - T / 2, -HX + T / 2, FY, top, HZ1 - T / 2, -46.5, OPAL);
  box(-HX - T / 2, -HX + T / 2, FY + 5, top, -46.5, -42.5, OPAL);
  wall(-HX, HZ0, -HX, -42.5, T / 2 + 0.02, FY - 1, top); wall(-HX, -46.5, -HX, HZ1, T / 2 + 0.02, FY - 1, top);
  // east wall: solid, with tall glowing windows
  box(HX - T / 2, HX + T / 2, FY, top, HZ1 - T / 2, HZ0 + T / 2, OPAL, { ink: true });
  wall(HX, HZ0, HX, HZ1, T / 2 + 0.02, FY - 1, top);
  // north wall: opening onto the outside balcony at balcony level (x -2.5..2.5, BAL .. BAL + 3.5)
  // (the lower part stops 2 cm under the balcony floor that crosses it, so the two tops never z-fight)
  box(-HX - T / 2, HX + T / 2, FY, BAL - 0.02, HZ1 - T / 2, HZ1 + T / 2, OPAL, { ink: true });
  box(-HX - T / 2, -2.5, BAL - 0.02, top, HZ1 - T / 2, HZ1 + T / 2, OPAL); box(2.5, HX + T / 2, BAL - 0.02, top, HZ1 - T / 2, HZ1 + T / 2, OPAL);
  box(-2.5, 2.5, BAL + 3.5, top, HZ1 - T / 2, HZ1 + T / 2, OPAL);
  wall(-HX, HZ1, HX, HZ1, T / 2 + 0.02, FY - 1, BAL - 0.2);
  wall(-HX, HZ1, -2.5, HZ1, T / 2 + 0.02, BAL - 0.1, top); wall(2.5, HZ1, HX, HZ1, T / 2 + 0.02, BAL - 0.1, top);
  // ceiling (blocks the camera, keeps it inside) + roof
  box(-HX - T / 2, HX + T / 2, top, top + 0.5, HZ1 - T / 2, HZ0 + T / 2, OPAL);
  add(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 24), holo(0.7), V(0, top - 0.04, -45));            // the oculus glow in the ceiling

  // tall windows: glowing panels inside and out
  const winGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const z of [-41, -45, -49]) for (const side of [-1, 1]) {
    if (side < 0 && z === -45) continue;                                  // the library arch is there
    for (const face of [-1, 1]) batch.add('hallWin', winGeo, WIN, V(side * (HX + face * (T / 2 + 0.02)), FY + 6.2, z), { scale: [0.04, 4.6, 1.3] });
  }
  for (const x of [-4.5, 4.5]) for (const face of [-1, 1]) batch.add('hallWin', winGeo, WIN, V(x, FY + 7.6, HZ0 + face * (T / 2 + 0.02)), { scale: [1.3, 3.2, 0.04] });
  // light shafts from the windows and the oculus
  K.rays([[0, FY, -45, 3.2, HH - 0.3], [-3.6, FY, -41.5, 1.4, 8], [1.5, FY, -40, 1.2, 7]], '#b49a7e');
  // interior pillars and a floating crystal chandelier
  for (const [x, z] of [[-5.6, -40.2], [5.6, -40.2], [-5.6, -48.6]]) {                        // (none where the spiral stairs turn)
    batch.add('hallPillar', new THREE.CylinderGeometry(0.42, 0.5, HH - 0.2, 8), OPAL, V(x, FY + (HH - 0.2) / 2, z));
    batch.add('hallPillarBand', new THREE.TorusGeometry(0.5, 0.06, 6, 16), GOLD, V(x, FY + 0.4, z), { rotX: Math.PI / 2 });
    batch.add('hallPillarBand', new THREE.TorusGeometry(0.5, 0.06, 6, 16), GOLD, V(x, top - 0.6, z), { rotX: Math.PI / 2 });
    post(x, z, 0.5, FY - 1, top);
  }
  const chand = new THREE.Group(); chand.position.set(0, FY + 7.4, -43.6); K.group.add(chand);
  { const im = new THREE.InstancedMesh(G.crystal, OPAL_GLOW, 10); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; tmpO.position.set(Math.cos(a) * 1.5, -0.3 - (i % 2) * 0.4, Math.sin(a) * 1.5); tmpO.rotation.set(Math.PI, 0, 0); tmpO.scale.set(0.5, 1.2, 0.5); tmpO.updateMatrix(); im.setMatrixAt(i, tmpO.matrix); } chand.add(im); }
  { const r = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 6, 40), GOLD); r.rotation.x = Math.PI / 2; chand.add(r); const g = glow('#fff0c8', 3.2, 0.28); chand.add(g); }
  animated.push((dt, t) => { chand.rotation.y = t * 0.15; chand.position.y = FY + 7.4 + Math.sin(t * 0.7) * 0.08; });

  // ----- balcony (mezzanine) along the north wall, reached by the spiral staircase -----
  box(-HX + T / 2, HX - T / 2, BAL - 0.35, BAL, HZ1 + T / 2, -47.2, toon('#fff4fb'), { solid: true, ink: true });
  for (let x = -6.4; x <= 6.5; x += 0.55) if (x < 2.7 || x > 6.2) batch.add('railPost', G.fence, OPAL, V(x, BAL + 0.3, -47.25));
  add(new THREE.BoxGeometry(9.4, 0.08, 0.16), GOLD, V(-2, BAL + 0.64, -47.25)); add(new THREE.BoxGeometry(0.8, 0.08, 0.16), GOLD, V(6.6, BAL + 0.64, -47.25));
  wall(-HX, -47.25, 2.7, -47.25, 0.12, BAL - 0.2, BAL + 1.4); wall(6.2, -47.25, HX, -47.25, 0.12, BAL - 0.2, BAL + 1.4);
  // spiral staircase: 18 floating opal steps around a column, one full turn from the floor to the balcony
  { const cx = 4.4, cz = -45.1, n = 18, rise = (BAL - FY) / n, dA = 0.349, a0 = Math.PI - (n - 1) * dA;
    const stepGeo = new THREE.BoxGeometry(0.66, 0.22, 1.85);
    for (let i = 0; i < n; i++) {
      const a = a0 + i * dA, dx = Math.sin(a), dz = Math.cos(a), y = FY + (i + 1) * rise;
      const p = V(cx + dx * 1.42, y - 0.11, cz + dz * 1.42);
      batch.add('spiralStep', stepGeo, i % 2 ? OPAL : toon('#fff4fb'), p, { rotY: a });
      hiddenSolid(stepGeo, p, a);
      batch.add('spiralPost', G.fence, GOLD, V(cx + dx * 2.25, y + 0.3, cz + dz * 2.25));
    }
    add(new THREE.CylinderGeometry(0.42, 0.5, BAL - FY + 0.6, 10), OPAL, V(cx, (FY + BAL + 0.6) / 2, cz), { ink: true }); post(cx, cz, 0.48, FY - 1, BAL + 2);
    box(3.5, 5.3, BAL - 0.3, BAL - 0.012, -47.55, -46.25, toon('#fff4fb'), { solid: true });      // top landing onto the balcony
  }
  const basinMat = calmWaterMat({ deep: '#9fc6ee', shallow: '#cbeaff', sky: '#ffe2cf', light: [0.6, 0.25, -0.75], centre: [0, -59.6], radius: 3 });
  // ----- outside balcony over the waterfalls (through the north wall opening) -----
  box(-3.6, 3.6, BAL - 0.4, BAL, HZ1 - 4.6, HZ1 + T / 2, toon('#fff4fb'), { solid: true, ink: true });
  for (let i = 0; i <= 26; i++) { const t = i / 26, x = -3.5 + 7 * Math.min(1, Math.max(0, (t - 0.25) * 2)), z = t < 0.25 ? HZ1 - 4.5 * (t / 0.25) : t > 0.75 ? HZ1 - 4.5 * ((1 - t) / 0.25) : HZ1 - 4.5;
    batch.add('railPost', G.fence, OPAL, V(t < 0.25 ? -3.5 : t > 0.75 ? 3.5 : x, BAL + 0.3, z)); }
  wall(-3.5, HZ1, -3.5, HZ1 - 4.5, 0.12, BAL - 0.2, BAL + 1.4); wall(-3.5, HZ1 - 4.5, 3.5, HZ1 - 4.5, 0.12, BAL - 0.2, BAL + 1.4); wall(3.5, HZ1 - 4.5, 3.5, HZ1, 0.12, BAL - 0.2, BAL + 1.4);
  add(new THREE.BoxGeometry(7.2, 0.08, 0.16), GOLD, V(0, BAL + 0.64, HZ1 - 4.5));
  for (const sx of [-3.5, 3.5]) add(new THREE.BoxGeometry(0.16, 0.08, 4.66), GOLD, V(sx, BAL + 0.64, HZ1 - 2.25));   // side rails (open sides), matching the front
  // the balcony's waterfalls land in a basin, which spills into a stream and off the north edge of the isle
  add(new THREE.TorusGeometry(2.8, 0.3, 8, 26), PEARL, V(0, FY + 0.22, -59.6), { r: [Math.PI / 2, 0, 0], ink: true });
  add(new THREE.CircleGeometry(2.75, 28).rotateX(-Math.PI / 2), basinMat, V(0, FY + 0.28, -59.6)); post(0, -59.6, 3.1, FY - 1, FY + 1.2);
  add(new THREE.PlaneGeometry(1.8, 3.2).rotateX(-Math.PI / 2), basinMat, V(0, FY + 0.05, -63.7)); post(0, -63.6, 1.4, FY - 1, FY + 1);
  for (const x of [-1.8, 1.8]) K.waterfall(V(x, BAL - 0.04, HZ1 - 4.66), [0, -1], 1.4, BAL - FY - 0.2, { out: 1.5 });    // spouts at the balcony's front edge
  // two tall falls from ledges on the north towers, into basins either side (you see them from the balcony)
  for (const s of [-1, 1]) {
    const tx = s * (HX + 0.6), tz = HZ1 - 0.6;
    add(new THREE.CylinderGeometry(1.4, 1.1, 0.35, 16, 1, false, Math.PI / 2, Math.PI), toon('#fff4fb'), V(tx, FY + 12, tz - 1.2), { ink: true });
    add(new THREE.TorusGeometry(1.2, 0.07, 6, 20, Math.PI), GOLD, V(tx, FY + 12.4, tz - 1.2), { r: [Math.PI / 2, 0, Math.PI] });
    K.waterfall(V(tx, FY + 12.05, tz - 2.4), [0, -1], 1.6, 12, { out: 1.1 });
    add(new THREE.TorusGeometry(1.7, 0.24, 8, 22), PEARL, V(tx, FY + 0.2, tz - 4.2), { r: [Math.PI / 2, 0, 0], ink: true });
    add(new THREE.CircleGeometry(1.65, 24).rotateX(-Math.PI / 2), basinMat, V(tx, FY + 0.26, tz - 4.2)); post(tx, tz - 4.2, 2, FY - 1, FY + 1);
  }
  K.waterfall(V(0, FY + 0.02, -65.1), [0, -1], 5.2, 31, { out: 2.6 });                         // the great north fall
  // more falls off the castle isle and the main island edges, into the cloud lagoon
  for (const s of [-1, 1]) {
    K.waterfall(V(s * 12.5, FY + 0.02, CZ - 14.3), [s * 12.5, -14.3], 3.2, 31);                     // castle isle, north-east / north-west
    K.waterfall(V(s * 9.2, FY + 0.02, CZ + 16.6), [s * 9.2, 16.6], 2.6, 31);                        // castle isle, either side of the bridge
    K.waterfall(V(s * 10.3, 0.02, -21.65), [s * 10.3, -21.7], 2.8, 28);                            // main island, north rim
  }
  // rainbows in the spray
  { const rb = add(new THREE.RingGeometry(10, 12.2, 48, 1, 0, Math.PI), rainbowMat(10, 12.2, 0.34), V(0, -16, -67.5)); rb.rotation.x = -0.2;
    const rb2 = add(new THREE.RingGeometry(8, 9.8, 48, 1, 0, Math.PI), rainbowMat(8, 9.8, 0.26), V(0, -14, -24)); rb2.rotation.x = -0.15; }

  // ----- the Starlight Library: west wing, x -17..-7, z -50..-39 -----
  const LX0 = -17, LX1 = -HX, LZ0 = -39, LZ1 = -50, LH = 8;
  add(new THREE.BoxGeometry(LX1 - LX0, 0.04, LZ0 - LZ1), toon('#efe6ff'), V((LX0 + LX1) / 2, FY - 0.008, (LZ0 + LZ1) / 2));
  box(LX0 - T / 2, LX1 - T / 2, FY, FY + LH, LZ0 - T / 2, LZ0 + T / 2, OPAL, { ink: true });        // south
  box(LX0 - T / 2, LX1 - T / 2, FY, FY + LH, LZ1 - T / 2, LZ1 + T / 2, OPAL, { ink: true });        // north
  box(LX0 - T / 2, LX0 + T / 2, FY, FY + LH, LZ1 - T / 2, LZ0 + T / 2, OPAL, { ink: true });        // west
  wall(LX0, LZ0, LX1, LZ0, T / 2 + 0.02, FY - 1, FY + LH); wall(LX0, LZ1, LX1, LZ1, T / 2 + 0.02, FY - 1, FY + LH); wall(LX0, LZ0, LX0, LZ1, T / 2 + 0.02, FY - 1, FY + LH);
  { const ceil = add(new THREE.BoxGeometry(LX1 - LX0 + T / 2, 0.4, LZ0 - LZ1 + T), [OPAL, OPAL, OPAL, starCeilMat(), OPAL, OPAL], V((LX0 - T / 2 + LX1) / 2, FY + LH + 0.2, (LZ0 + LZ1) / 2)); K.occlude(ceil); }   // ends inside the hall wall
  add(new THREE.CircleGeometry(1.6, 28), WIN, V(LX0 + T / 2 + 0.02, FY + 4.4, -44.5), { r: [0, Math.PI / 2, 0] });   // round west window
  add(new THREE.TorusGeometry(1.65, 0.12, 6, 30), GOLD, V(LX0 + T / 2 + 0.05, FY + 4.4, -44.5), { r: [0, Math.PI / 2, 0] });
  const book = new THREE.BoxGeometry(0.14, 0.42, 0.3), wood = toon('#c7a2d8');
  const shelf = (x, z, alongX, len) => {
    add(G.box, wood, V(x, FY + 1.6, z), { s: alongX ? [len, 3.2, 0.6] : [0.6, 3.2, len], ink: true });
    if (alongX) wall(x - len / 2, z, x + len / 2, z, 0.36, FY - 1, FY + 4); else wall(x, z - len / 2, x, z + len / 2, 0.36, FY - 1, FY + 4);
    const n = Math.floor(len / 0.2), face = alongX ? (z > -44.5 ? -1 : 1) : 1;
    for (let row = 0; row < 4; row++) for (let i = 0; i < n; i++) {
      const o = -len / 2 + 0.1 + i * 0.2, p = alongX ? V(x + o, FY + 0.55 + row * 0.72, z + face * 0.32) : V(x + face * 0.32, FY + 0.55 + row * 0.72, z + o);
      batch.add('libBook', book, toon('#ffffff'), p, { rotY: alongX ? 0 : Math.PI / 2, color: ['#ff9fd6', '#d9b8ff', '#b5d8ff', '#b8ffe9', '#fff3b0', '#ffc7a0'][(i * 7 + row * 3 + ((R() * 3) | 0)) % 6] });
    }
  };
  shelf(-12, LZ0 - 0.75, true, 6.8); shelf(-12, LZ1 + 0.75, true, 6.8); shelf(LX0 + 0.75, -41.2, false, 2.6); shelf(LX0 + 0.75, -47.8, false, 2.6);
  const LCX = -11.6, LCZ = -44.5;
  add(new THREE.CylinderGeometry(3.2, 3.2, 0.03, 32), toon('#3a3088'), V(LCX, FY + 0.03, LCZ)); add(new THREE.CylinderGeometry(2.6, 2.6, 0.03, 32), toon('#5b4fb0'), V(LCX, FY + 0.045, LCZ));
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; batch.add('rugStar', G.star, flat('#fff1b0'), V(LCX + Math.cos(a) * 2.9, FY + 0.07, LCZ + Math.sin(a) * 2.9), { scale: [0.6, 0.2, 0.6] }); }
  const orrery = new THREE.Group(); orrery.position.set(LCX, FY + 4.4, LCZ); K.group.add(orrery);           // a slowly turning star orrery overhead
  { const sun = new THREE.Mesh(G.sphere, flat('#ffe6a0')); sun.scale.setScalar(0.35); orrery.add(sun); orrery.add(glow('#ffe6a0', 3, 0.55));
    for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 + i * 0.6, 0.03, 4, 40), GOLD); ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3; orrery.add(ring);
      const pl = new THREE.Mesh(G.sphere, holo()); pl.scale.setScalar(0.14 + i * 0.03); pl.userData.r = 0.9 + i * 0.6; pl.userData.sp = 0.6 - i * 0.15; pl.userData.tilt = (i - 1) * 0.3; orrery.add(pl); } }
  animated.push((dt, t) => { for (const c of orrery.children) if (c.userData.r) { const a = t * c.userData.sp + c.userData.r; c.position.set(Math.cos(a) * c.userData.r, Math.sin(a) * c.userData.r * Math.sin(c.userData.tilt), Math.sin(a) * c.userData.r); } orrery.rotation.y = t * 0.05; });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; batch.add('libStar', G.star, toon('#fff1b0', { emissive: '#ffe08a', emissiveIntensity: 0.8 }), V(LCX + Math.cos(a) * 4.2, FY + 6.4 + (i % 2) * 0.3, LCZ + Math.sin(a) * 4.2), { scale: [0.7, 1, 0.7], rotY: a }); }
  K.setCircle({ key: 'library', name: 'Starlight Library', x: LCX, z: LCZ, y: FY, r: 3.4, seats: K.seats(LCX, FY, LCZ, 2.2, 6, ['#b9a4ff', '#ffd6f0', '#a8d8ff', '#fff1b0']), label: V(LCX, FY + 6.2, LCZ), labelDist: 13 });

  // ----- castle exterior: spiral crystal spires, floating gold rings, glowing windows -----
  // a twisted hexagonal spire (the facets spiral upwards)
  const twisted = (r0, r1, h, turns, seg = 6, hs = 8) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg, hs); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = (y / h + 0.5) * turns * 6.283, x = p.getX(i), z = p.getZ(i); p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)); }
    g.computeVertexNormals(); return g; };
  const towerGeo = twisted(1.75, 1.45, 1, 0.35), capGeo = twisted(1.75, 0.02, 1, 0.6, 6, 6);
  const towers = [[-HX - 0.6, HZ0 + 0.6, 16], [HX + 0.6, HZ0 + 0.6, 16], [-HX - 0.6, HZ1 - 0.6, 19], [HX + 0.6, HZ1 - 0.6, 19], [LX0 - 0.4, LZ0 + 0.4, 12], [LX0 - 0.4, LZ1 - 0.4, 13]];
  const rings = [];
  for (const [x, z, h] of towers) {
    const k = h > 14 ? 1 : 0.8;
    batch.add('tower', towerGeo, OPAL, V(x, FY + h / 2, z), { scale: [k, h, k] });
    batch.add('towerCap', capGeo, OPAL_GLOW, V(x, FY + h + 2.6 * k, z), { scale: [k * 1.15, 5.2 * k, k * 1.15] });
    batch.add('towerTip', G.star, GOLD, V(x, FY + h + 5.4 * k, z), { scale: [1.2, 1.8, 1.2] });
    for (const y of [FY + h * 0.45, FY + h * 0.78]) for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + y; batch.add('towerWin', winGeo, WIN, V(x + Math.cos(a) * 1.62 * k, y, z + Math.sin(a) * 1.62 * k), { scale: [0.45, 1.1, 0.06], rotY: -a + Math.PI / 2 }); }
    post(x, z, 1.9 * k, FY - 1, FY + h);
    rings.push({ x, y: FY + h + 1.2, z, r: 2.5 * k, sp: 0.25 + R() * 0.2, tilt: 0.25 + R() * 0.2 });
  }
  // the grand central spire rising from the roof
  add(twisted(3.1, 2.5, 14, 0.4), OPAL, V(0, top + 7, -45), { ink: true });
  add(twisted(2.5, 0.05, 12, 0.7, 6, 8), OPAL_GLOW, V(0, top + 20, -45), { ink: true });
  const crown = add(G.star, GOLD, V(0, top + 26.8, -45), { s: [4, 6, 4], ink: true }), crownGlow = glow('#ffe9b0', 9, 0.7); crownGlow.position.copy(crown.position); K.group.add(crownGlow);
  for (const y of [top + 3, top + 7, top + 11]) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + y * 0.4; batch.add('towerWin', winGeo, WIN, V(Math.cos(a) * 2.9, y, -45 + Math.sin(a) * 2.9), { scale: [0.6, 1.4, 0.06], rotY: -a + Math.PI / 2 }); }
  for (const [y, r] of [[top + 4.5, 4.6], [top + 10.5, 3.8], [top + 16, 3.1], [top + 21, 2.2]]) rings.push({ x: 0, y, z: -45, r, sp: 0.18 + R() * 0.12, tilt: 0.18 + R() * 0.25 });
  const ringSet = movingSet(new THREE.TorusGeometry(1, 0.032, 6, 56), GOLD, rings.length);
  for (const rg of rings) rg.ph = R() * 6;
  animated.push((dt, t) => { crown.rotation.y = t * 0.4; crownGlow.material.opacity = 0.6 + 0.12 * Math.sin(t * 1.5);
    rings.forEach((rg, i) => { tmpO.position.set(rg.x, rg.y + Math.sin(t * 0.6 + rg.ph) * 0.25, rg.z); tmpO.rotation.set(Math.PI / 2 + Math.sin(t * 0.3 + rg.ph) * rg.tilt, t * rg.sp, Math.cos(t * 0.25 + rg.ph) * rg.tilt * 0.6); tmpO.scale.setScalar(rg.r); tmpO.updateMatrix(); ringSet.setMatrixAt(i, tmpO.matrix); });
    ringSet.instanceMatrix.needsUpdate = true; });
  // floating crystal shards drifting around the castle
  const shards = [], shardSet = movingSet(G.crystal, OPAL_GLOW, 12);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, d = 13 + R() * 6; shards.push({ x: Math.cos(a) * d, y: FY + 6 + R() * 14, z: CZ + Math.sin(a) * d, h: 1.6 + R() * 1.2, ph: R() * 6 }); }
  animated.push((dt, t) => { shards.forEach((s, i) => { tmpO.position.set(s.x, s.y + Math.sin(t * 0.5 + s.ph) * 0.6, s.z); tmpO.rotation.set(0, t * 0.2 + s.ph, 0); tmpO.scale.set(0.8, s.h, 0.8); tmpO.updateMatrix(); shardSet.setMatrixAt(i, tmpO.matrix); }); shardSet.instanceMatrix.needsUpdate = true; });
  // the doorway glow and a carpet of light out to the bridge
  { const g = glow('#fff1d0', 5, 0.22); g.position.set(0, FY + 3, HZ0 + 1.6); K.group.add(g); }
  K.path([[0, CY, -28.6], [0, CY, -37]], '#fff4fb', THEME.holo, 0.8);
  for (const [x, z] of [[-2.6, -31], [2.6, -31], [-2.6, -35.4], [2.6, -35.4], [-12, -56], [12, -56]]) K.lamp(x, CY, z);
  K.keepOut.push([0, -45, 11.5], [-12, -44.5, 7]);
  garden(-8.5, CY, -31.6, 3, 2); garden(8.5, CY, -31.6, 3, 2);

  // =====================================================================
  //  THE CLOUD LAGOON far below
  // =====================================================================
  const LAG_Y = -28;
  add(new THREE.CircleGeometry(190, 56).rotateX(-Math.PI / 2), calmWaterMat({ deep: '#8fa6dc', shallow: '#c4e6f2', sky: '#ffd9c6', light: [0.6, 0.25, -0.75], lightCol: '#fff0c8', path: 1.4, centre: [0, -20], radius: 170 }), V(0, LAG_Y, -20));
  for (let i = 0; i < 46; i++) { const a = R() * 6.283, d = 26 + R() * 140, s = 3 + R() * 7; batch.add('lagoonCloud', G.puff, toon('#ffffff'), V(Math.cos(a) * d, LAG_Y + s * 0.15, -20 + Math.sin(a) * d), { scale: [s * 1.6, s * 0.45, s * 1.2], rotY: R() * 6 }); }
  for (let i = 0; i < 14; i++) { const a = R() * 6.283, d = 30 + R() * 70; K.mist(Math.cos(a) * d, LAG_Y + 2, -20 + Math.sin(a) * d, 30 + R() * 20); }

  // =====================================================================
  //  PEGASUS STABLE ISLE (east): a gold-domed open stable where pegasi land and idle
  // =====================================================================
  const SX = 40, SZ = 2, SY = 3;
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.52, x = SX + Math.cos(a) * 3.4, z = SZ + Math.sin(a) * 3.4; batch.add('stableCol', new THREE.CylinderGeometry(0.2, 0.26, 3.2, 8), PEARL, V(x, SY + 1.6, z)); post(x, z, 0.3, SY - 1, SY + 3.4); }
  add(new THREE.SphereGeometry(4.1, 24, 8, 0, 6.283, 0, Math.PI / 2), GOLD, V(SX, SY + 3.2, SZ), { s: [1, 0.55, 1], ink: true });
  add(new THREE.TorusGeometry(4.05, 0.14, 6, 30), PEARL, V(SX, SY + 3.2, SZ), { r: [Math.PI / 2, 0, 0], ink: true });
  const sStar = add(G.star, toon('#fff1b0', { emissive: '#ffe08a', emissiveIntensity: 0.8 }), V(SX, SY + 6, SZ), { s: [1.4, 2, 1.4], ink: true });
  animated.push((dt, t) => { sStar.rotation.y = t * 0.7; });
  for (const [dx, dz] of [[-1.8, -1], [1.6, -1.6], [0.2, 2.1]]) K.clump(SX + dx, SY, SZ + dz, 0.55, '#fff6d6');                  // cloud hay
  add(new THREE.BoxGeometry(2, 0.5, 0.7), toon('#d9c6ff'), V(SX + 2.4, SY + 0.25, SZ + 0.8), { ink: true }); add(new THREE.BoxGeometry(1.8, 0.04, 0.5), calmWaterMat({ deep: '#9fc6ee', shallow: '#cbeaff', sky: '#ffe2cf', radius: 2, centre: [SX + 2.4, SZ + 0.8] }), V(SX + 2.4, SY + 0.48, SZ + 0.8)); post(SX + 2.4, SZ + 0.8, 1.1, SY - 1, SY + 1);
  // two pegasi that circle the sky, glide in, land, idle for a while, then take off again
  const landers = [[SX - 4.5, SZ + 5.5, '#ffffff'], [SX + 5.2, SZ + 3.5, '#fff1d6']].map(([lx, lz, col], i) => {
    const p = makePet('pegasus', 2.4, col); K.group.add(p.group);
    return { p, spot: V(lx, SY, lz), state: 'sky', t: 4 + i * 9, a: i * 3, pos: V(0, 0, 0), from: V(0, 0, 0), yaw: 0 };
  });
  const skyPt = (L, a) => V(SX + Math.cos(a) * 22, 17 + Math.sin(a * 2) * 2.5, SZ + Math.sin(a) * 22);
  const ease = (x) => x * x * (3 - 2 * x);
  animated.push((dt, t) => {
    for (const L of landers) {
      L.t -= dt; let fly = true, move = 1;
      if (L.state === 'sky') { L.a += dt * 0.12; const p = skyPt(L, L.a); L.yaw = Math.atan2(p.x - L.pos.x, p.z - L.pos.z) || L.yaw; L.pos.copy(p); if (L.t <= 0) { L.state = 'land'; L.t = 5; L.from.copy(L.pos); } }
      else if (L.state === 'land') { const u = ease(1 - L.t / 5), p = L.from.clone().lerp(L.spot, u); p.y = L.from.y + (L.spot.y - L.from.y) * (1 - (1 - u) * (1 - u)); L.yaw = Math.atan2(L.spot.x - L.from.x, L.spot.z - L.from.z); L.pos.copy(p); if (L.t <= 0) { L.state = 'idle'; L.t = 10 + Math.random() * 10; L.pos.copy(L.spot); } }
      else if (L.state === 'idle') { fly = false; move = 0; L.yaw += Math.sin(t * 0.4 + L.a) * dt * 0.3; if (L.t <= 0) { L.state = 'off'; L.t = 4; L.from.copy(L.pos); L.a = Math.atan2(L.spot.z - SZ, L.spot.x - SX); } }
      else { const u = ease(1 - L.t / 4), p = L.from.clone().lerp(skyPt(L, L.a), u); p.y = L.from.y + (17 - L.from.y) * u * u; L.yaw = Math.atan2(p.x - L.pos.x, p.z - L.pos.z) || L.yaw; L.pos.copy(p); if (L.t <= 0) { L.state = 'sky'; L.t = 12 + Math.random() * 14; } }
      L.p.group.position.copy(L.pos); L.p.group.rotation.y = L.yaw; L.p.update(dt, { move, fly });
    }
  });
  K.sound('wings', V(SX, SY + 4, SZ), 22, 0.8);

  const astra = K.npc('Astra the Star Librarian', K.person('fairy', 5, 3), V(-15.2, CY, -40.6), 0.8, ['Shh, the stars are reading. The circle in the middle keeps everyone\'s time.', 'Up the spiral stairs there is a balcony over the waterfalls. Go there on your break.', 'Every book here was finished one focus round at a time.']);
  K.thing({ pos: V(0, BAL, HZ1 - 3.4), r: 2.8, label: 'Watch the waterfalls', height: 1.6, tag: V(0, BAL + 2.4, HZ1 - 3.4), fx: 18, use: (i) => ['The water falls a long way, into a lagoon of clouds. A rainbow hangs in the spray.', 'You breathe out. Breaks are part of the work.'][(i.n = (i.n || 0) + 1) % 2] });
  K.drift('fairy', 4, 0, CY + 2, -44, 6);
  // phones (low quality): the two landing pegasi and Astra are only drawn within ~34 m of you, so the far
  // side of the map costs nothing; high quality always draws them
  { const far = [...landers.map((L) => L.p.group), astra.m.group];
    animated.push((dt, t, ctx, low) => { const pp = ctx && ctx.playerPos; for (const g of far) g.visible = !low || !pp || g.position.distanceTo(pp) < 34; }); }
  { const walls = new THREE.Mesh(mergeGeos(opalGeos), OPAL); K.group.add(walls); }

  return K.finish({
    spawn: V(0, 0, 13.2), spawnYaw: Math.PI,
    env: Object.assign({}, L.env, { sparkle: [[0, 0, 0, 30, 7], [0, 0, 0, 30, 7], [40, 3, 2, 12, 6], [49, 7.4, -16, 9, 5], [-38, -2.6, -3, 13, 6], [0, CY, CZ, 18, 12]] }),
  });
}
