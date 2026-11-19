/* Moonlit Pavilion — a lake at night: an arrival shore, a bridge to the island with the glowing dance pavilion,
   a second bridge climbing to the Reading Terrace (the Study Circle), and lily-pad stones to Willow Islet. */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, flat, THEME } from '../toon.js';
import { calmWaterMat } from '../surfaces.js';

export function build() {
  const K = makeKit('pavilion', 53), { R, G, add, solid, post, wall, batch, animated } = K;
  const MOON = [0.35, 0.42, -0.84], GRASS = '#9fd6b6', WARM = '#ffd9a0';
  // the lake (not solid: you cannot walk on it). Calm (no speckles, no glare) but moving: dark navy-indigo, slow ripples
  // drifting across it, a soft moon path that shimmers, soft reflections of the pavilion and lanterns, fog at the horizon
  const lakeMat = calmWaterMat({ deep: '#080d30', shallow: '#18245e', sky: '#3a4894', light: MOON, lightCol: '#dfe6ff', path: 1.15, lightsCol: '#ffc98a', centre: [0, 0], radius: 120, motion: 1 });
  add(new THREE.CircleGeometry(170, 48).rotateX(-Math.PI / 2), lakeMat, V(0, -0.55, 0));
  const isle = (x, y, z, r) => K.island(x, y, z, r, { top: GRASS, cliff: '#efe4c8', keel: '#8f88c8', rim: false, tips: false });
  isle(0, 0, 21, 11);                                    // arrival shore
  isle(0, 0, -8, 11);                                    // pavilion island
  isle(20, 1.2, -20, 7.5);                               // reading terrace (higher)
  isle(-17, 0, -14, 5);                                  // willow islet
  // gentle lapping where the shores meet the lake
  for (const [cx, cz, r, n] of [[0, 21, 11, 5], [0, -8, 11, 4], [20, -20, 7.5, 2], [-17, -14, 5, 2]]) for (let i = 0; i < n; i++) { const a = i / n * 6.283 + 0.4; K.sound('shore', V(cx + Math.cos(a) * (r + 0.6), -0.4, cz + Math.sin(a) * (r + 0.6)), 13, 0.8); }

  // ----- bridges -----
  const LIL = ['#efe9ff', '#d9ccff', '#e6dcff'];
  K.bridge(V(0, 0, 10.5), V(0, 0, 2.5), 1.0, { n: 10, cols: LIL, rail: '#efe9ff', ball: WARM, rope: '#c9bdf0' });
  K.bridge(V(9.1, 0, -13.5), V(13.9, 1.2, -16.3), 0.6, { n: 8, width: 2.6, cols: LIL, rail: '#efe9ff', ball: WARM, rope: '#c9bdf0' });
  for (let i = 0; i < 4; i++) { const p = V(-10.1, 0, -11.4).lerp(V(-12.9, 0, -12.5), i / 3);        // lily-pad stepping stones
    solid(add(new THREE.CylinderGeometry(1.05, 0.9, 0.3, 12), toon(i % 2 ? '#7fd0a8' : '#8fdcb4'), V(p.x, -0.15 + i * 0.004, p.z), { ink: true }), false); }

  // ----- the dance pavilion: a raised pearl floor under a glowing ring -----
  const PX = 0, PZ = -8, PY = 0.6;
  K.mesa(PX, 0, PZ, 5.2, PY, { side: '#c9bdf0', top: THEME.pearl });
  K.stairs(PX, 0, PZ + 5.2 + 1.4, Math.PI, 2, { w: 4, landing: 0.5, cols: ['#e6dcff', '#f4efff'] });
  K.stairs(PX, 0, PZ - 5.2 - 1.4, 0, 2, { w: 4, landing: 0.5, cols: ['#e6dcff', '#f4efff'] });
  add(new THREE.CylinderGeometry(4.2, 4.2, 0.02, 30), holo(0.6), V(PX, PY + 0.07, PZ));
  const colGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.6, 10);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283, x = PX + Math.cos(a) * 4.7, z = PZ + Math.sin(a) * 4.7;
    batch.add('pcol', colGeo, toon('#f4efff'), V(x, PY + 1.8, z)); post(x, z, 0.3, 0, PY + 3.8);
    const l = add(G.box, flat(WARM), V(x * 0.94, PY + 3.0, PZ + (z - PZ) * 0.94), { s: [0.24, 0.32, 0.24] }); animated.push((dt, t) => { l.position.y = PY + 3.0 + Math.sin(t * 2 + i) * 0.05; });
    if (i % 2 === 0) { const g = glow('#ffcf90', 2.6, 0.55); g.position.copy(l.position); K.group.add(g); } }
  add(new THREE.TorusGeometry(4.75, 0.22, 8, 40), holo(), V(PX, PY + 3.7, PZ), { r: [Math.PI / 2, 0, 0], ink: true });
  add(new THREE.TorusGeometry(3.2, 0.1, 6, 32), holo(), V(PX, PY + 4.4, PZ), { r: [Math.PI / 2, 0, 0] });
  const pstar = add(G.star, toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.8 }), V(PX, PY + 4.9, PZ), { s: [1.5, 2, 1.5], ink: true });
  const floorGlow = glow('#c9b5ff', 13, 0.4); floorGlow.position.set(PX, PY + 1.2, PZ); K.group.add(floorGlow);
  const pulse = add(new THREE.TorusGeometry(1, 0.03, 4, 40), flat('#ffffff', { transparent: true, opacity: 0.6 }), V(PX, PY + 0.1, PZ), { r: [Math.PI / 2, 0, 0] });
  animated.push((dt, t) => { const u = (t * 0.3) % 1; pulse.scale.set(u * 4.2, u * 4.2, 1); pulse.material.opacity = 0.6 * (1 - u); pstar.rotation.y = t * 0.6; floorGlow.material.opacity = 0.32 + 0.08 * Math.sin(t * 1.5); });

  // ----- Reading Terrace (Study Circle) on the higher island -----
  const TX = 20, TZ = -20, TY = 1.2;
  add(new THREE.CylinderGeometry(5.6, 5.6, 0.04, 30), toon('#efe9ff'), V(TX, TY + 0.03, TZ)); add(new THREE.CylinderGeometry(3.4, 3.4, 0.02, 28), holo(0.6), V(TX, TY + 0.06, TZ));
  const balGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.8, 6);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283, b = (i + 1) / 26 * 6.283, x = TX + Math.cos(a) * 6.9, z = TZ + Math.sin(a) * 6.9;
    if (Math.hypot(x - 13.9, z + 16.3) < 2.3) continue;                                              // gap where the bridge lands
    batch.add('bal', balGeo, toon('#efe9ff'), V(x, TY + 0.4, z)); batch.add('balTop', G.sphere, toon('#d9ccff'), V(x, TY + 0.86, z), { scale: 0.14 });
    if (Math.hypot(TX + Math.cos(b) * 6.9 - 13.9, TZ + Math.sin(b) * 6.9 + 16.3) >= 2.3) wall(x, z, TX + Math.cos(b) * 6.9, TZ + Math.sin(b) * 6.9, 0.12, TY - 1, TY + 1.3); }
  add(G.cyl, toon('#c9bdf0'), V(TX, TY + 0.55, TZ - 3.9), { s: [0.14, 1.1, 0.14], ink: true }); add(G.box, toon('#fffaf0'), V(TX, TY + 1.15, TZ - 3.9), { s: [0.9, 0.08, 0.6], r: [0.35, 0, 0], ink: true }); post(TX, TZ - 3.9, 0.5, TY, TY + 2);
  K.setCircle({ name: 'Reading Terrace', x: TX, z: TZ, y: TY, r: 3.7, seats: K.seats(TX, TY, TZ, 2.5, 6, ['#cbbcf6', '#b9c8ff', '#e6c8ff', '#ffe9b0'], 0.9), label: V(TX, TY + 4.2, TZ) });
  const lantern = (x, y, z) => K.lamp(x, y, z, { kind: 'lantern', post: '#8f88c8', color: WARM, glow: '#ffcf90', size: 3.2 });
  lantern(TX - 4.6, TY, TZ + 3.4); lantern(TX + 4.8, TY, TZ - 2.6); lantern(TX - 1.5, TY, TZ - 5.4);

  // ----- floating lanterns and lily pads on the water -----
  const onWater = (x, z) => ![[0, 21, 12.5], [0, -8, 12.5], [20, -20, 9], [-17, -14, 6.5]].some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r) && !(Math.abs(x) < 2.5 && z > 2 && z < 11);
  const lanterns = new THREE.Group(); K.group.add(lanterns);
  for (let i = 0, n = 0; n < 26 && i < 500; i++) { const x = (R() - 0.5) * 90, z = (R() - 0.5) * 90; if (!onWater(x, z)) continue; n++;
    const m = new THREE.Mesh(G.box, flat([WARM, '#ffc2d2', '#ffe9b0'][n % 3])); m.position.set(x, -0.3, z); m.scale.set(0.42, 0.5, 0.42); lanterns.add(m); m.userData.ph = R() * 6;
    if (n <= 10) { const g = glow('#ffcf90', 3, 0.5); g.position.set(x, -0.1, z); lanterns.add(g); } }
  animated.push((dt, t) => { lanterns.position.y = Math.sin(t * 1.2) * 0.05; lanterns.position.x = Math.sin(t * 0.1) * 0.6; });
  { const L = lakeMat.uniforms.uLights.value; L[0].set(PX, 3.2, PZ, 1.3);                              // the pavilion's glowing ring
    lanterns.children.filter((m) => m.isMesh).slice(0, 5).forEach((m, i) => L[i + 1].set(m.position.x, 0.2, m.position.z, 0.9));
    lakeMat.uniforms.uN.value = 6; }
  for (let i = 0, n = 0; n < 40 && i < 600; i++) { const x = (R() - 0.5) * 80, z = (R() - 0.5) * 80; if (!onWater(x, z)) continue; n++;
    batch.add('lily', G.disc, toon('#ffffff'), V(x, -0.5 + (n % 9) * 0.004, z), { scale: [0.7 + R() * 0.5, 0.6, 0.7 + R() * 0.5], rotY: R() * 6, color: n % 2 ? '#7fd0a8' : '#6cc49a' });
    if (n % 3 === 0) batch.add('lilyFlower', G.petal, toon('#ffffff'), V(x, -0.36, z), { scale: [1.3, 0.8, 1.3], color: n % 2 ? '#ffc2e4' : '#ffffff' }); }

  // ----- props -----
  K.gates(0, 0, 27.4, Math.PI, 4.1);
  K.keepOut.push([PX, PZ, 7.6], [TX, TZ, 7.5], [0, 24, 9], [0, 12, 3], [0, 1.5, 3], [10, -13, 3.5], [-10, -11, 3]);
  K.path([[0, 0, 22], [0, 0, 11.4]], '#efe9ff', ['#d9ccff', '#ffe9b0']); K.path([[0, 0, 1.6], [0, 0, -1]], '#efe9ff', ['#d9ccff']); K.path([[4.6, 0, -11], [8.4, 0, -13]], '#efe9ff', ['#d9ccff']); K.path([[-4.8, 0, -10], [-9.4, 0, -11.2]], '#efe9ff', ['#d9ccff']);
  for (const [x, y, z] of [[-2.2, 0, 16], [2.2, 0, 12.6], [-2.4, 0, 0.6], [2.4, 0, 0.6], [7, 0, -3.5], [-7.5, 0, -4.5], [-15.5, 0, -11.6]]) lantern(x, y, z);
  const MOONTREE = ['#b9aaf0', '#c9b8ff', '#a9b6f0'];
  for (const [x, y, z, s] of [[-6.5, 0, 24.5, 1.1], [7, 0, 23, 1.2], [-7.5, 0, 17, 1], [6.8, 0, 16.5, 0.9], [-8, 0, -1.5, 1.1], [8.2, 0, -8.5, 1], [-7.6, 0, -13.5, 1], [3.5, 0, -16.5, 1.2], [-18.5, 0, -15.5, 1.5], [24.5, 1.2, -23, 1]]) K.tree(x, y, z, s, MOONTREE[(x + 40 | 0) % 3], '#75638f');
  K.crystal(-4.6, 0, -15.6, 0.9); K.crystal(5.8, 0, 26.6, 0.8); K.crystal(15.6, 1.2, -24.2, 0.9); K.rock(-5, 0, 14, 1); K.rock(6.5, 0, 0.5, 0.9);
  add(G.box, toon('#c9bdf0'), V(-15.2, 0.35, -15.8), { s: [1.8, 0.2, 0.6], r: [0, 0.6, 0], ink: true }); post(-15.2, -15.8, 0.8, 0, 1);       // bench on Willow Islet
  K.flowers(0, 0, 21, 10, 90, { cols: ['#d9b8ff', '#b5d8ff', '#ffffff', '#ffe9b0'], tuft: '#8fd0a8' }); K.flowers(0, 0, -8, 10, 90, { cols: ['#d9b8ff', '#b5d8ff', '#ffffff'], tuft: '#8fd0a8' });
  K.flowers(20, 1.2, -20, 6.4, 34, { cols: ['#d9b8ff', '#ffffff'], tuft: '#8fd0a8' }); K.flowers(-17, 0, -14, 4.2, 30, { cols: ['#d9b8ff', '#ffe9b0'], tuft: '#8fd0a8' });

  // ----- life -----
  K.npc('Madame Celestine', K.person('princess', 1, 1), V(PX - 1.2, PY, PZ + 0.5), 1.8, ['One, two, three. One, two, three. Even study has a rhythm, my dear.', 'The Reading Terrace is across the far bridge, up where the lanterns gather.', 'Dance in your breaks. It shakes the facts into place.'], 1.2);
  K.npc('Sir Alder', K.person('prince', 3, 3), V(PX + 1.4, PY, PZ - 0.6), 1.8, ['I have been practising this turn for an hour. Repetition, you see.', 'The moon keeps better time than I do.'], 1.2);
  K.npc('Moonpuff', K.animal('bunny', 1.6), V(-17.5, 0, -13), 1.6, ['Moonpuff is watching the moon in the water. One ear twitches at you.', 'The rabbit yawns. It is a very peaceful islet.'], 1.3);
  K.thing({ pos: V(-15.2, 0, -15.8), r: 2.6, label: 'Float a lantern', height: 1.2, tag: V(-15.2, 2, -15.8), fx: 20, use: (i) => ['You set a paper lantern on the water. It joins the others and drifts toward the moon.', 'Another wish afloat. The lake does not mind.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: V(TX, TY, TZ - 3.9), r: 2.2, label: 'Read the open book', height: 1.6, tag: V(TX, TY + 2.4, TZ - 3.9), use: () => '"Chapter One: sit down. Chapter Two: begin." The rest of the pages are blank, waiting for you.' });

  return K.finish({
    spawn: V(0, 0, 17.6),
    env: { sky: { day: ['#080e34', '#1b2468', '#3d4196'] }, cycle: false, stars: 1, moon: true, glow: 0.9, sunDir: MOON,
      fog: { day: '#202b6c', near: 20, far: 125 }, hemi: ['#c0c4ff', '#5a62a8', 1.1], sun: ['#f2eeff', 0.85],
      weather: { kind: 'firefly', vel: [0.12, 0.06, 0.08], size: 0.26, color: '#fff3a0', sway: 1.3, twinkle: 1, n: 280, box: [38, 7, 38] },
      sparkle: [[0, 0, 21, 12, 5], [0, 0, -8, 13, 6], [20, 1.2, -20, 9, 5]], sparkleCol: '#e6dcff' },
  });
}
