/* Petalwood — a flower-house forest: giant blossoms, a spiral of mushroom caps climbing to the Canopy Deck,
   Sunny Knoll, flower houses, fairies with glowing trails, and the Blossom Study Circle. */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, flat, THEME } from '../toon.js';

export function build() {
  const K = makeKit('petalwood', 91), { R, G, add, solid, post, batch, animated } = K;
  const GRASS = '#bff0b4', PETAL = ['#ff9fd6', '#d9b8ff', '#ffc7a0', '#b5d8ff', '#ffb3d9'];
  K.floor(0, 0, 0, 36, toon(GRASS));
  K.boundary(0, 0, 30, -1, 6);
  for (let i = 0; i < 30; i++) { const a = i / 30 * 6.283 + R() * 0.1, d = 31.5 + R() * 2.5; K.tree(Math.cos(a) * d, 0, Math.sin(a) * d, 1.9 + R() * 1.2, ['#8fdc9c', '#a6e6a8', '#ffc2e4', '#7fd09a'][i % 4], '#a57e66'); }   // the forest wall
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + 0.1, d = 29.4 + R(); batch.add('hedge', G.puff, toon('#ffffff'), V(Math.cos(a) * d, 0.7, Math.sin(a) * d), { scale: [2, 1.2, 1.6], rotY: R() * 6, color: i % 2 ? '#8fd9a8' : '#7fcf9c' }); }

  let glows = 0;
  // giant blossom: a flower taller than you, with a wide head to walk under
  function blossom(x, y, z, s, col) {
    const h = 3.4 * s;
    batch.add('bStem', G.cyl, toon('#6fd09a'), V(x, y + h / 2, z), { scale: [0.16 * s, h, 0.16 * s] });
    for (const k of [-1, 1]) batch.add('bLeaf', G.sphere, toon('#8fe0b0'), V(x + k * 0.6 * s, y + h * (0.3 + (k + 1) * 0.1), z), { scale: [0.65 * s, 0.08 * s, 0.3 * s], rotZ: k * 0.5 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; batch.add('bigPetal', G.sphere, toon('#ffffff'), V(x + Math.cos(a) * 0.95 * s, y + h + 0.02, z + Math.sin(a) * 0.95 * s), { scale: [0.75 * s, 0.14 * s, 0.42 * s], rotY: -a, rotZ: 0.25, color: i % 2 ? col : '#ffffff' }); }
    add(G.sphere, toon('#fff3a8', { emissive: '#ffd95e', emissiveIntensity: 0.35 }), V(x, y + h + 0.16, z), { s: [0.42 * s, 0.3 * s, 0.42 * s], ink: true });
    if (glows++ < 6) { const g = glow('#fff3b0', 3.4 * s, 0.4); g.position.set(x, y + h + 0.3, z); K.group.add(g); }
    post(x, z, 0.3 * s, y, y + 3); K.shadow(x, y, z, 1.5 * s); K.keepOut.push([x, z, 1.3]);
  }
  // flower house: a round cottage under a roof of drooping petals
  function flowerHouse(x, z, yaw, col) {
    add(G.cyl, toon('#fff4e2'), V(x, 1.2, z), { s: [1.7, 2.4, 1.7], ink: true });
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; batch.add('housePetal', G.sphere, toon('#ffffff'), V(x + Math.cos(a) * 1.25, 2.75, z + Math.sin(a) * 1.25), { scale: [1.25, 0.24, 0.8], rotY: -a, rotZ: -0.5, color: i % 2 ? col : '#fff6fb' }); }
    add(G.sphere, toon('#ffe08a'), V(x, 3.25, z), { s: [0.55, 0.45, 0.55], ink: true });
    add(G.cyl, toon('#c9966e'), V(x + Math.sin(yaw) * 1.68, 0.75, z + Math.cos(yaw) * 1.68), { s: [0.42, 1.5, 0.12] });
    add(G.sphere, flat('#ffe9a0'), V(x + Math.sin(yaw + 0.8) * 1.66, 1.5, z + Math.cos(yaw + 0.8) * 1.66), { s: 0.26 });
    const g = glow('#ffe9a0', 2, 0.45); g.position.set(x + Math.sin(yaw + 0.8) * 1.9, 1.5, z + Math.cos(yaw + 0.8) * 1.9); K.group.add(g);
    post(x, z, 1.85, 0, 3.5); K.keepOut.push([x, z, 3]);
  }
  // mushroom you can sit beside (small) — the big walkable ones are built below
  function shroom(x, y, z, s, col) { batch.add('shStem', G.cyl, toon('#fff6ea'), V(x, y + 0.3 * s, z), { scale: [0.16 * s, 0.6 * s, 0.16 * s] }); batch.add('shCap', G.dome, toon('#ffffff'), V(x, y + 0.5 * s, z), { scale: [0.55 * s, 0.4 * s, 0.55 * s], color: col }); post(x, z, 0.4 * s, y, y + 1.2); K.keepOut.push([x, z, 0.8]); }

  // ----- Blossom Study Circle (centre): mushroom stools around a great open flower -----
  const CX = 0, CZ = -6;
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; add(G.sphere, toon(i % 2 ? '#ffc2e4' : '#ffe1f2'), V(CX + Math.cos(a) * 2.1, 0.05 + i * 0.004, CZ + Math.sin(a) * 2.1), { s: [1.9, 0.05, 1.05], r: [0, -a, 0] }); }
  add(G.cyl, toon('#fff3a8', { emissive: '#ffd95e', emissiveIntensity: 0.4 }), V(CX, 0.12, CZ), { s: [0.95, 0.2, 0.95], ink: true }); post(CX, CZ, 0.95, 0, 1.4);
  const orb = add(G.sphere, holo(), V(CX, 1.1, CZ), { s: 0.36, ink: true }), og = glow('#fff3b0', 4.4, 0.6); og.position.copy(orb.position); K.group.add(og);
  animated.push((dt, t) => { orb.position.y = 1.1 + Math.sin(t * 1.6) * 0.1; og.position.y = orb.position.y; og.material.opacity = 0.5 + 0.14 * Math.sin(t * 2); });
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; batch.add('ringShroom', G.dome, toon('#ffffff'), V(CX + Math.cos(a) * 4.5, 0.1, CZ + Math.sin(a) * 4.5), { scale: [0.16, 0.14, 0.16], color: i % 2 ? '#ff8fb8' : '#c9a0ff' }); }   // fairy ring
  { const arch = add(new THREE.TorusGeometry(2.4, 0.13, 6, 24, Math.PI), toon('#7fd6a4'), V(CX, 0, CZ - 5.2), { ink: true }); arch.scale.y = 1.25;
    for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; add(G.petal, toon(PETAL[i % 5]), V(CX + Math.cos(a) * 2.4, Math.sin(a) * 3.0, CZ - 5.2), { s: 1.9 }); }
    for (const s of [-1, 1]) post(CX + s * 2.4, CZ - 5.2, 0.25, 0, 3.4); }
  K.setCircle({ name: 'Blossom Study Circle', x: CX, z: CZ, y: 0, r: 4.0, seats: K.seats(CX, 0, CZ, 3.0, 6, ['#ff8fb8', '#c9a0ff', '#ffb68a'], 0.52, 'mushroom'), label: V(CX, 4.6, CZ - 2) });

  // ----- the mushroom spiral (west): seven caps climbing around a giant stalk to the Canopy Deck -----
  const MX = -16, MZ = -7, CAP = new THREE.CylinderGeometry(1.5, 1.2, 0.4, 14);
  add(G.cyl, toon('#fff6ea'), V(MX, 1.75, MZ), { s: [1.5, 3.5, 1.5], ink: true }); post(MX, MZ, 1.7, 0, 3.4);
  for (let i = 0; i < 7; i++) {
    const a = 0.15 + i * 0.33, x = MX + Math.cos(a) * 5.3, z = MZ + Math.sin(a) * 5.3, top = 0.45 * (i + 1);
    solid(add(CAP, toon(['#ff8fb8', '#c9a0ff', '#ffb68a'][i % 3]), V(x, top - 0.2, z), { ink: true }), false);
    add(G.cyl, toon('#fff6ea'), V(x, (top - 0.4) / 2, z), { s: [0.3, Math.max(0.05, top - 0.4), 0.3] });
    for (const [ox, oz] of [[0.6, 0.3], [-0.5, 0.5], [0.1, -0.7]]) add(G.sphere, toon('#ffffff'), V(x + ox, top + 0.005 * (i + 1), z + oz), { s: [0.2, 0.02, 0.2] });
  }
  solid(add(new THREE.CylinderGeometry(4.5, 3.4, 0.5, 20), toon('#ff9fc0'), V(MX, 3.35, MZ), { ink: true }));                       // Canopy Deck: top at y = 3.6
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, d = 1 + (i % 3) * 1.2; add(G.sphere, toon('#ffffff'), V(MX + Math.cos(a) * d, 3.602 + i * 0.002, MZ + Math.sin(a) * d), { s: [0.38, 0.02, 0.38] }); }
  blossom(MX - 1.6, 3.6, MZ - 1.5, 0.7, '#d9b8ff'); const dl = add(G.sphere, holo(), V(MX + 2.2, 4.5, MZ + 1.2), { s: 0.3, ink: true }), dg = glow('#b8ffe9', 3, 0.6); dg.position.copy(dl.position); K.group.add(dg);
  add(G.cyl, toon('#7fd6a4'), V(MX + 2.2, 3.9, MZ + 1.2), { s: [0.06, 0.6, 0.06] }); post(MX + 2.2, MZ + 1.2, 0.35, 3.6, 5);
  // ----- Sunny Knoll (east, up a ramp or steps) -----
  K.mesa(17, 0, 3, 5.2, 1.2, { side: '#a8dca8', top: '#d6f7c0' });
  K.ramp(17, 0, 13.2, Math.PI, 5.2, 1.2, 2.8, '#c9efb8'); K.stairs(8.4, 0, 3, Math.PI / 2, 4, { w: 3, landing: 0.8, cols: ['#ffe3f4', '#fff4fb'] });
  add(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 16), toon('#ff9fd6'), V(17.5, 1.25, 2.5)); add(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 16), toon('#ffffff'), V(17.5, 1.262, 2.5));     // picnic blanket
  add(G.box, toon('#c9966e'), V(17.9, 1.48, 2.2), { s: [0.5, 0.36, 0.36], ink: true }); blossom(20, 1.2, 5.4, 0.8, '#ffc7a0');

  flowerHouse(-10, 12, 1.0, '#ff9fd6'); flowerHouse(10.5, 14.5, -0.9, '#d9b8ff'); flowerHouse(11, -13, -0.5, '#ffc7a0'); flowerHouse(-7.5, -18, 0.4, '#b5d8ff'); flowerHouse(22, -6, -1.5, '#ffb3d9');

  K.gates(0, 0, 26.5, Math.PI);
  K.keepOut.push([CX, CZ, 6.6], [MX, MZ, 8.4], [17, 3, 7], [0, 22, 9], [17, 11, 3.6], [8, 3, 3]);
  K.path([[0, 0, 22], [0, 0, -1.4]], '#fff0d6', PETAL); K.path([[-1.5, 0, 7], [-7, 0, 1], [-10, 0, -5]], '#fff0d6', PETAL); K.path([[1.5, 0, 8], [7.4, 0, 3.4]], '#fff0d6', PETAL); K.path([[4, 0, 12], [12, 0, 15.5], [17, 0, 14]], '#fff0d6', PETAL);
  for (const [x, z, s, c] of [[-5.5, 15, 1.1, 0], [6, 19, 0.9, 1], [-14, 20, 1.2, 2], [14, 21, 1, 3], [-22, 6, 1.2, 4], [5.5, -15, 1.1, 0], [-3.5, -21, 1, 1], [20, -15, 1.2, 2], [24, 12, 1, 4], [-21, -17, 1.1, 3], [7, -3, 0.9, 1], [-7.5, -11.5, 1, 2]]) blossom(x, 0, z, s, PETAL[c]);
  for (let i = 0, n = 0; n < 9 && i < 300; i++) { const [x, z] = K.inDisc(0, 0, 7, 27); if (K.free(x, z, 2)) { K.tree(x, 0, z, 1 + R() * 0.5, ['#ffc2e4', '#ffd3ec', '#e6ccff'][n % 3], '#a57e66'); n++; } }
  for (let i = 0, n = 0; n < 14 && i < 300; i++) { const [x, z] = K.inDisc(0, 0, 5, 27.5); if (K.free(x, z, 1)) { shroom(x, 0, z, 0.8 + R() * 0.9, ['#ff8fb8', '#c9a0ff', '#ffb68a'][n % 3]); n++; } }
  for (let i = 0, n = 0; n < 6 && i < 200; i++) { const [x, z] = K.inDisc(0, 0, 8, 27); if (K.free(x, z, 2)) { K.clump(x, 0, z, 0.7 + R() * 0.5, '#8fd9a8'); n++; } }
  for (const [x, y, z] of [[-2.3, 0, 17], [2.3, 0, 12], [-2.4, 0, 4.5], [2.6, 0, -0.6], [-8.6, 0, -1.4], [9.6, 0, 5.6], [14.4, 0, 14.6]]) K.lamp(x, y, z, { post: '#a8dcb8' });
  K.flowers(0, 0, 0, 28.5, 320, { cols: PETAL }); K.flowers(17, 1.2, 3, 4.4, 30, { cols: PETAL }); K.flowers(MX, 3.6, MZ, 3.6, 16, { cols: PETAL });
  K.sheen(0, 0, 0, 29, 40, 0.14);
  { const dap = flat('#fff6c0', { transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });   // dappled light on the forest floor
    for (let i = 0; i < 34; i++) { const [x, z] = K.inDisc(0, 0, 2, 28); batch.add('dapple', G.blob, dap, V(x, 0.03, z), { scale: [1.2 + R() * 2.4, 1, 1 + R() * 1.6], rotY: R() * 3 }); } K.lowHide.push('dapple'); }
  K.rays([[-6, 0, 6, 4, 22], [8, 0, -4, 5, 24], [-12, 0, -14, 4, 22], [14, 0, 10, 5, 24], [0, 0, -12, 4, 22], [-18, 0, 12, 4, 20], [20, 0, -8, 4, 22], [3, 0, 16, 4, 20]], '#fff0b8');

  K.drift('fairy', 7, 0, 1.8, -2, 20, 1.6); K.drift('butterfly', 7, 0, 1, 4, 22);
  for (const [x, y, z] of [[0, 2, -2], [MX + 2.2, 4.5, MZ + 1.2], [-6, 2, 10], [8, 2, 6]]) K.sound('chimes', V(x, y, z), 15, 0.9);       // soft chimes near the fairies
  K.npc('Thistle', K.person('fairy', 2, 2), V(-4, 0, 3), 2.4, ['Welcome to Petalwood! The stools around the great flower are for studying. Sit, sit!', 'Climb the mushroom spiral to the west. The Canopy Deck has the best view.', 'We fairies leave sparkles behind us. It is a bit embarrassing, to be honest.']);
  K.npc('Fennel', K.person('fairy', 4, 0), V(MX + 0.5, 3.6, MZ + 2), 1.6, ['You made it up the spiral! Most visitors stop at the third cap.', 'From here you can see every flower house. Mine is the pink one.']);
  K.npc('Bramble', K.animal('puppy', 1.5, '#d9b48c'), V(16, 1.2, 4.2), 2, ['Bramble has found the picnic basket and is guarding it. Loudly.', 'A wag. You may pass.'], 1.5);
  K.thing({ pos: V(17.9, 1.2, 2.2), r: 2.2, label: 'Peek in the picnic basket', height: 1, tag: V(17.9, 2.6, 2.2), fx: 14, use: (i) => ['Honey cakes and petal tea. For after your focus round, the note says.', 'One honey cake is missing. Bramble looks innocent.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: V(MX + 2.2, 3.6, MZ + 1.2), r: 2.2, label: 'Touch the dew lantern', height: 1.4, tag: V(MX + 2.2, 5.3, MZ + 1.2), fx: 22, use: () => 'It chimes like a tiny bell, and every fairy in the wood looks up. ✦' });
  K.thing({ pos: V(CX, 0, CZ - 5.2), r: 2, label: 'Smell the blossom arch', height: 2.6, tag: V(CX, 3.9, CZ - 5.2), use: () => 'Honeysuckle, warm grass, and a faint note of fresh notebooks.' });

  return K.finish({
    spawn: V(0, 0, 17),
    env: { sky: { day: ['#86caff', '#d2efff', '#fff3de'], eve: ['#7a6ae0', '#ffa8d0', '#ffd9a8'] }, cycle: true, clouds: true,
      fog: { day: '#e2f7e0', eve: '#ffd2da', near: 24, far: 120 }, hemi: ['#ffffff', '#c8f0c8', 1.5, '#ffc0d8'], sun: ['#fff3d0', 1.6, '#ffc4a8'],
      weather: { kind: 'petal', vel: [0.5, -0.85, 0.2], size: 0.2, color: '#ffb0d8', sway: 0.7, n: 240, box: [40, 16, 40] },
      sparkle: [[0, 0, 0, 28, 6]] },
  });
}
