/* Skyfield — floating islands at four heights: main island with the gazebo plateau,
   Tea Isle (up the rainbow bridge), Lookout (up the cloud steps), Crystal Isle (down the west bridge). */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, THEME } from '../toon.js';

export function build() {
  const K = makeKit('skyfield', 20261117), { R, G, add, solid, post, wall, batch, animated } = K;
  const M = K.island(0, 0, 0, 24), TEA = K.island(39, 3, 0, 7.5), LOOK = K.island(49, 7.4, -16, 5), CRY = K.island(-38, -2.6, -3, 8.5);

  // ----- plateau, stairs, ramp -----
  const PX = 0, PZ = -6, PH = 2.4, GY = PH + 0.25;
  K.mesa(PX, 0, PZ, 8.5, PH);
  for (let i = 0; i < 30; i++) {                         // pearl fence around the rim, open at the stairs and the ramp
    const a = i / 30 * 6.283, x = PX + Math.cos(a) * 8.15, z = PZ + Math.sin(a) * 8.15;
    if (Math.abs(a - Math.PI / 2) < 0.26 || a < 0.2 || a > 6.08) continue;
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
  K.bridge(V(23.2, 0, 1.5), V(32.3, 3, 0.6), 1.1);                       // main → Tea Isle (climbs)
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
  const TREE = ['#ffc2e4', '#ffd3ec', '#e6ccff', '#ffd9c2'];
  for (let i = 0, n = 0; n < 13 && i < 300; i++) { const [x, z] = K.inDisc(0, 0, 6, 21); if (K.free(x, z, 1.6)) { K.tree(x, 0, z, 0.9 + R() * 0.5, TREE[n % 4]); n++; } }
  for (let i = 0, n = 0; n < 7 && i < 200; i++) { const [x, z] = K.inDisc(0, 0, 5, 22); if (K.free(x, z, 1.2)) { K.crystal(x, 0, z, 0.8 + R() * 0.5); n++; } }
  K.tree(39, 3, -0.5, 1.7, '#ffc2e4'); K.tree(-41, -2.6, -7, 1.1, '#e6ccff');
  for (const [x, z, s] of [[-36, -6, 1.6], [-42, -1, 1.2], [-34, 1.5, 1.0], [-40, 2.2, 1.4], [-44, -5, 0.9]]) K.crystal(x, -2.6, z, s);
  K.crystal(51, 7.4, -18.6, 1.1); K.crystal(3.5, PH, -12.3, 0.8); K.crystal(-4, PH, -12, 0.7);
  for (const [x, y, z, s] of [[9, 0, 15, 1.3], [-8, 0, 16, 1.1], [17, 0, -9, 1.4], [-16, 0, -11, 1.5], [41.5, 3, 4, 1], [6, PH, -11.5, 0.8]]) K.clump(x, y, z, s);
  K.flowers(0, 0, 0, 22.8, 320); K.flowers(39, 3, 0, 6.5, 50); K.flowers(49, 7.4, -16, 4.2, 26); K.flowers(-38, -2.6, -3, 7.5, 46);

  // wishing pool, signpost, tea table, telescope
  const POOL = V(-12, 0, 8);
  add(new THREE.TorusGeometry(2.1, 0.32, 8, 22), toon(THEME.pearl), V(POOL.x, 0.2, POOL.z), { r: [Math.PI / 2, 0, 0], ink: true });
  const water = add(new THREE.CylinderGeometry(2.05, 2.05, 0.1, 22), holo(0.85), V(POOL.x, 0.22, POOL.z)); post(POOL.x, POOL.z, 2.4, 0, 1.2);
  const pg = glow('#bfe6ff', 5, 0.35); pg.position.set(POOL.x, 0.7, POOL.z); K.group.add(pg); animated.push((dt, t) => { water.rotation.y = t * 0.1; });
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
  K.thing({ pos: V(3.6, 0, 13.6), r: 2.4, label: 'Read the signpost', height: 2, tag: V(3.6, 2, 13.6), use: (i) => ['Skyfield ✦ Gazebo: up the stairs · Tea Isle and Lookout: east bridge · Crystal Isle: west bridge', 'The gates at the south rim open onto the Lagoon, Hollyhollow, the Pavilion and Petalwood.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: POOL, r: 3.6, label: 'Make a wish', height: 1.2, tag: V(POOL.x, 1.6, POOL.z), fx: 26, use: () => 'You toss a wish into the pool. ✦' });
  K.thing({ pos: V(51.6, 7.4, -14.6), r: 2.4, label: 'Look through the telescope', height: 2, tag: V(51.6, 9.6, -14.6), use: () => 'Far below, four more realms glitter through the clouds.' });

  return K.finish({
    spawn: V(0, 0, 13.2), spawnYaw: Math.PI,
    env: { sky: { day: ['#6fb8ff', '#bfe3ff', '#ffe0f4'], eve: ['#6d5fe0', '#ff9fd2', '#ffd3a0'] }, cycle: true, clouds: true, flyers: true,
      fog: { day: '#dcecff', eve: '#ffc9dc', near: 40, far: 210 }, hemi: ['#ffffff', '#d9c8ff', 1.5, '#ffb8d8'], sun: ['#fff6e0', 1.7, '#ffc4a8'],
      sparkle: [[0, 0, 0, 30, 7], [0, 0, 0, 30, 7], [39, 3, 0, 12, 6], [49, 7.4, -16, 9, 5], [-38, -2.6, -3, 13, 6]] },
  });
}
