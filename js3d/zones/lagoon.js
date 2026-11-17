/* Coral Lagoon — an underwater mermaid kingdom: a seabed ringed by reef, a reef terrace with shell homes,
   a coral knoll, a kelp forest, and the Pearl Study Grotto in the middle. */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, flat, outline, THEME } from '../toon.js';
import { causticMat, kelpMat } from '../surfaces.js';

// Old Barnaby: a small crab built from primitives (same interface as makeAvatar / makePet)
function makeCrab() {
  const group = new THREE.Group(), S = new THREE.SphereGeometry(1, 10, 7), red = toon('#ff8f7a');
  const part = (g, m, p, s, ink) => { const x = new THREE.Mesh(g, m); x.position.set(...p); x.scale.set(...s); if (ink) outline(x); group.add(x); return x; };
  part(S, red, [0, 0.3, 0], [0.42, 0.24, 0.3], true);
  const legs = [];
  for (const s of [-1, 1]) {
    part(S, red, [s * 0.52, 0.5, 0.18], [0.16, 0.13, 0.13], true);
    part(S, flat('#ffffff'), [s * 0.14, 0.62, 0.2], [0.07, 0.07, 0.07]); part(S, flat('#4a2f5e'), [s * 0.14, 0.63, 0.26], [0.035, 0.035, 0.03]);
    for (let i = 0; i < 3; i++) legs.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5), red, [s * (0.42 + i * 0.02), 0.14, -0.12 + i * 0.12], [1, 1, 1]));
    legs[legs.length - 1].userData.s = s;
  }
  let ph = 0;
  return { group, height: 0.8, update(dt, st) { ph += dt * (st.move ? 16 : 2); legs.forEach((l, i) => { l.rotation.z = (i < 3 ? -1 : 1) * (0.7 + Math.sin(ph + i * 2) * 0.25); }); group.position.y += 0; } };
}

export function build() {
  const K = makeKit('lagoon', 31), { R, G, add, solid, post, batch, animated } = K;
  const sand = causticMat();
  K.floor(0, 0, 0, 36, sand);
  K.boundary(0, 0, 30, -1, 6);
  for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283, d = 31 + R() * 2.5, s = 2 + R() * 2.2; batch.add('reef', G.rock, toon('#ffffff'), V(Math.cos(a) * d, s * 0.5, Math.sin(a) * d), { scale: [s, s * (0.9 + R()), s], rotY: R() * 6, color: ['#8f7fd0', '#b08ae0', '#6f9fd8', '#d98ac8'][i % 4] }); }

  // glowing branch coral
  const branch = new THREE.CapsuleGeometry(0.09, 0.9, 2, 6); let glows = 0;
  function coral(x, y, z, s, col, lit) {
    const n = 4 + ((R() * 3) | 0);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R(), tilt = 0.25 + R() * 0.5, h = (0.7 + R() * 0.7) * s;
      batch.add('coral', branch, toon('#ffffff'), V(x + Math.cos(a) * tilt * h * 0.5, y + h * 0.5, z + Math.sin(a) * tilt * h * 0.5), { scale: [s, h, s], rotZ: -Math.cos(a) * tilt, rotX: Math.sin(a) * tilt, color: col });
      batch.add('coralTip', G.sphere, flat('#fff6fa'), V(x + Math.cos(a) * tilt * h * 1.02, y + h * 1.0, z + Math.sin(a) * tilt * h * 1.02), { scale: 0.1 * s }); }
    if (lit && glows++ < 12) { const g = glow(col, 3 * s, 0.4); g.position.set(x, y + s * 0.8, z); K.group.add(g); animated.push((dt, t) => { g.material.opacity = 0.3 + 0.15 * Math.sin(t * 2 + x); }); }
    post(x, z, 0.45 * s, y, y + 2); K.shadow(x, y, z, 0.9 * s); K.keepOut.push([x, z, 1]);
  }
  // shell home: pearly dome with a round door and a lit window
  function shellHome(x, y, z, yaw, col) {
    add(G.dome, toon(col), V(x, y, z), { s: [2.3, 2.5, 2.3], ink: true });
    for (let i = -2; i <= 2; i++) add(new THREE.TorusGeometry(2.32, 0.05, 4, 16, Math.PI), toon('#ffffff'), V(x, y, z), { r: [0, yaw + i * 0.5, 0], s: [1, 1.08, 1] });
    add(G.cyl, toon('#6a56a0'), V(x + Math.sin(yaw) * 2.15, y + 0.75, z + Math.cos(yaw) * 2.15), { s: [0.55, 1.5, 0.3] });
    add(G.sphere, flat('#fff2b0'), V(x + Math.sin(yaw + 0.75) * 2.05, y + 1.3, z + Math.cos(yaw + 0.75) * 2.05), { s: 0.3 });
    const g = glow('#ffe9a0', 2.4, 0.5); g.position.set(x + Math.sin(yaw + 0.75) * 2.3, y + 1.3, z + Math.cos(yaw + 0.75) * 2.3); K.group.add(g);
    add(G.star, toon(THEME.gold), V(x, y + 2.75, z), { ink: true });
    post(x, z, 2.45, y, y + 3); K.keepOut.push([x, z, 3.4]);
  }

  // ----- Pearl Study Grotto (centre): a low dais inside a horseshoe of rocks, under a giant open shell -----
  const GX = 0, GZ = -4, GY = 0.2;
  solid(add(new THREE.CylinderGeometry(4.7, 4.9, 0.2, 28), toon('#fff0f8'), V(GX, 0.1, GZ), { ink: true }));
  add(new THREE.CylinderGeometry(3.4, 3.4, 0.02, 28), holo(0.6), V(GX, GY + 0.03, GZ));
  for (let i = 0; i < 13; i++) { const a = Math.PI * (0.72 + i * 0.13), s = 1.5 + R() * 1.1; if (i === 6) continue; K.rock(GX + Math.cos(a) * 6.6, 0, GZ + Math.sin(a) * 6.6, s, ['#a493e0', '#c7a4ea', '#8fb0e6'][i % 3]); }
  add(G.dome, holo(1, true), V(GX, 0.3, GZ - 6.3), { s: [3.6, 3.8, 3.6], r: [0.55, 0, 0], ink: true });                 // the shell's raised lid
  add(G.cyl, toon('#ffb8da'), V(GX, 0.35, GZ - 5.6), { s: [3.5, 0.5, 2.2], ink: true }); post(GX, GZ - 6, 3.2, 0, 4);
  add(G.cyl, toon('#d9c6ff'), V(GX, GY + 0.2, GZ), { s: [0.5, 0.4, 0.5], ink: true }); post(GX, GZ, 0.6, 0, 2);
  const pearl = add(G.sphere, holo(), V(GX, GY + 1.0, GZ), { s: 0.48, ink: true }), pg = glow('#e6f4ff', 4.5, 0.6); pg.position.copy(pearl.position); K.group.add(pg);
  animated.push((dt, t) => { pearl.position.y = GY + 1.0 + Math.sin(t * 1.5) * 0.08; pg.position.y = pearl.position.y; pg.material.opacity = 0.5 + 0.15 * Math.sin(t * 2); });
  K.setCircle({ name: 'Pearl Study Grotto', x: GX, z: GZ, y: GY, r: 3.9, seats: K.seats(GX, GY, GZ, 2.6, 6, ['#ffc2e0', '#d9c8ff', '#bfe9ff', '#b8ffe9'], 0.2), label: V(GX, 5.4, GZ - 3) });

  // ----- reef terrace (east, up the steps or the ramp): shell homes on a higher level -----
  K.mesa(16, 0, -9, 7, 1.8, { side: '#b9a0e8', topMat: sand });
  K.stairs(8.08, 0, -1.08, Math.PI * 0.75, 6, { landing: 1.2, cols: ['#ffd9ec', '#fff0f8'] });      // climbs north-east onto the terrace
  K.ramp(16, 0, 3.3, Math.PI, 5.6, 1.8, 3, '#e8d6ff');
  shellHome(18.5, 1.8, -12, -0.7, '#ffc9de'); shellHome(13.5, 1.8, -12.8, 0.5, '#d9c8ff'); shellHome(19.6, 1.8, -6.6, -1.5, '#c4ecff');
  // ----- coral knoll (west, up a ramp): a lookout with the Beacon Pearl -----
  K.mesa(-17, 0, 6, 5, 1.2, { side: '#e8a8d0', topMat: sand });
  K.ramp(-9.2, 0, 6, -Math.PI / 2, 3.6, 1.2, 2.8, '#ffd9ec');
  add(G.cyl, toon('#fff0f8'), V(-18.5, 1.6, 6), { s: [0.35, 0.8, 0.35], ink: true }); post(-18.5, 6, 0.5, 1.2, 3.2);
  const beacon = add(G.sphere, holo(), V(-18.5, 2.5, 6), { s: 0.55, ink: true }), bg = glow('#bff3ff', 6, 0.55); bg.position.copy(beacon.position); K.group.add(bg);
  // ----- shell homes on the seabed, rock arch, treasure chest -----
  shellHome(-9, 0, -15, 0.6, '#ffc9de'); shellHome(-17, 0, -10, 1.1, '#bfe9ff');
  for (const s of [-1, 1]) K.rock(8 + s * 2.6, 0, 12, 2.2, '#9f8fe0'); add(G.rock, toon('#b9a8ea'), V(8, 4.2, 12), { s: [4.2, 1.2, 1.8], ink: true });
  add(G.box, toon('#c9966e'), V(-6, 0.35, 14), { s: [1.3, 0.7, 0.9], ink: true }); add(G.cyl, toon('#b9824e'), V(-6, 0.7, 14), { s: [0.45, 1.3, 0.45], r: [0, 0, Math.PI / 2], ink: true });
  add(G.star, toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.8 }), V(-6, 1.25, 14), { ink: true }); post(-6, 14, 0.9, 0, 1.5);

  K.gates(0, 0, 26.5, Math.PI);
  K.keepOut.push([GX, GZ, 9], [16, -9, 9.5], [-17, 6, 7], [0, 22, 9], [16, 1, 4], [-10, 6, 4], [9, -2.5, 4]);
  K.path([[0, 0, 22], [0, 0, 3]], '#fff0dc', ['#ffc2e0', '#d9c8ff', '#bfe9ff']); K.path([[1, 0, 8], [9, 0, 2], [16, 0, 4]], '#fff0dc', ['#ffc2e0']); K.path([[-1, 0, 8], [-8, 0, 6]], '#fff0dc', ['#bfe9ff']); K.path([[3, 0, 5], [7.4, 0, -0.4]], '#fff0dc', ['#d9c8ff']);

  const CORAL = ['#ff9ebb', '#ffb68a', '#c9a0ff', '#ff8fd0', '#8fd3ff'];
  for (let i = 0, n = 0; n < 26 && i < 500; i++) { const [x, z] = K.inDisc(0, 0, 5, 28); if (K.free(x, z, 1.4)) { coral(x, 0, z, 0.9 + R() * 0.9, CORAL[n % 5], n % 2 === 0); n++; } }
  coral(14, 1.8, -5, 1.2, '#ff9ebb', true); coral(21, 1.8, -10, 1, '#c9a0ff', true); coral(-15, 1.2, 3.5, 1, '#ffb68a', true);
  // kelp forest: tall swaying blades (one instanced mesh, animated in its shader) — you can walk through it
  const blade = new THREE.PlaneGeometry(0.5, 1, 1, 6), km = kelpMat();
  for (let i = 0; i < 90; i++) { const west = i < 60, [x, z] = west ? K.inDisc(-15, -18 + (i % 3) * 14, 0, 7) : K.inDisc(0, 0, 8, 29); if (!west && !K.free(x, z, 0.6)) continue; const h = 2 + R() * 4; batch.add('kelp', blade, km, V(x, h / 2, z), { scale: [0.7 + R() * 0.6, h, 1], rotY: R() * 3 }); }
  for (let i = 0; i < 9; i++) { const [x, z] = K.inDisc(0, 0, 6, 27); if (K.free(x, z, 1.6)) K.rock(x, 0, z, 0.8 + R() * 0.9, ['#a493e0', '#8fb0e6'][i % 2]); }
  K.flowers(0, 0, 0, 28, 260, { stem: '#58c9a0', tuft: '#6fd8b0', cols: CORAL, tufts: 0.55 });
  K.sheen(0, 0, 0, 29, 40, 0.12);
  K.rays([[-8, 0, 4, 5, 26], [9, 0, -2, 6, 28], [2, 0, 14, 5, 24], [-16, 0, -8, 6, 27], [18, 0, 8, 5, 25], [-4, 0, -16, 6, 28], [12, 0, -18, 5, 26], [-20, 0, 12, 5, 24], [0, 0, -4, 7, 28]], '#bfefff');

  K.drift('jelly', 10, 0, 2.6, 0, 24, 3);
  K.npc('Marisol the Pearl-Keeper', K.person('mermaid', 2, 1), V(4.6, 0, 3.4), 2, ['Welcome below the waves. The pearl in the grotto keeps time for all of us.', 'Settle on a shell cushion and stay still. The circle will find you.', 'Up the steps to the east are the shell homes. Mind the crab.']);
  K.npc('Ondine', K.person('mermaid', 1, 3), V(15, 1.8, -8), 2.2, ['I moved to the terrace for the light. The caustics are lovely up here.', 'A focused hour and the whole reef glows brighter. Probably.']);
  K.npc('Old Barnaby', makeCrab, V(9, 0, 9), 3, ['Old Barnaby clicks a claw at you. It sounds like "get back to work".', 'He scuttles sideways, unimpressed.'], 1.6);
  K.thing({ pos: V(-18.5, 1.2, 6), r: 2.6, label: 'Touch the Beacon Pearl', height: 2.6, tag: V(-18.5, 3.6, 6), fx: 24, use: () => 'The pearl hums. Somewhere far above, a sunbeam finds its way down. ✦' });
  K.thing({ pos: V(-6, 0, 14), r: 2.4, label: 'Open the treasure chest', height: 1.4, tag: V(-6, 2, 14), fx: 18, use: (i) => ['Inside: one sugar star and a note that says "break time is treasure too".', 'Still just the note. And sand.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: V(GX, 0, GZ - 4.4), r: 2.2, label: 'Listen to the great shell', height: 2.4, tag: V(GX, 4.2, GZ - 5), use: () => 'You hear the sea, and under it, pages turning.' });

  return K.finish({
    spawn: V(0, 0, 17),
    env: { sky: { day: ['#a8f4f6', '#3fb0d6', '#2a5cae'] }, cycle: false, glow: 1.6, sunDir: [0.05, 1, -0.05],
      fog: { day: '#3aa3cc', near: 6, far: 62 }, hemi: ['#e6fdff', '#6fb8de', 1.45], sun: ['#f2ffff', 1.25],
      weather: { kind: 'bubble', vel: [0, 1.1, 0], size: 0.22, color: '#eaffff', sway: 0.25, ring: true, n: 300, box: [40, 18, 40] },
      sparkle: [[0, 0, 0, 28, 6]], sparkleCol: '#bff3ff' },
  });
}
