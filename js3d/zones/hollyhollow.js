/* Hollyhollow — a snowy village at night: cobbled lanes, cottages with warm windows, Lantern Hill,
   a frozen pond, and the Fireplace Library (walk in through the open front) holding the Study Circle. */
import * as THREE from 'three';
import { makeKit, V } from '../kit.js';
import { toon, holo, glow, flat, THEME } from '../toon.js';

export function build() {
  const K = makeKit('hollyhollow', 77), { R, G, add, solid, post, wall, batch, animated } = K;
  const SNOW = '#e6edfb', WARM = '#ffd98a';
  K.floor(0, 0, 0, 36, toon(SNOW));
  K.boundary(0, 0, 30, -1, 6);
  for (let i = 0; i < 54; i++) { const a = i / 54 * 6.283 + R() * 0.08, d = 31 + R() * 3.5; K.pine(Math.cos(a) * d, 0, Math.sin(a) * d, 1.3 + R() * 1.1); }   // the forest wall

  // roof prism: a triangle extruded along the building's depth
  const roofGeo = (w, h, d) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; };
  let lit = 0; const winMat = flat(WARM);
  // cottage centred at (x, z), front door facing `yaw`
  function cottage(x, z, yaw, col, w = 5, d = 4.2, h = 2.8) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), at = (r, f, y) => V(x + rx * r + fx * f, y, z + rz * r + fz * f), rot = { r: [0, yaw, 0] };
    K.occlude(add(new THREE.BoxGeometry(w, h, d), toon(col), V(x, h / 2, z), Object.assign({ ink: true }, rot)));
    add(roofGeo(w + 0.9, 2.1, d + 0.7), toon('#6a4a78'), V(x, h, z), rot); add(roofGeo(w + 1.0, 2.1, d + 0.5), toon('#f6f9ff'), V(x, h + 0.2, z), { r: [0, yaw, 0], s: [0.94, 1, 1] });
    batch.add('chimney', G.box, toon('#7a5a78'), at(w * 0.25, -0.5, h + 1.6), { scale: [0.6, 1.5, 0.6], rotY: yaw }); batch.add('chimSnow', G.box, toon('#f6f9ff'), at(w * 0.25, -0.5, h + 2.4), { scale: [0.72, 0.14, 0.72], rotY: yaw });
    batch.add('door', G.box, toon('#5a3d58'), at(0, d / 2 + 0.03, 0.95), { scale: [0.95, 1.9, 0.1], rotY: yaw });
    for (const s of [-1, 1]) batch.add('window', G.box, winMat, at(s * w * 0.3, d / 2 + 0.04, 1.6), { scale: [0.9, 0.9, 0.08], rotY: yaw });
    batch.add('window', G.box, winMat, at(w / 2 + 0.04, 0, 1.6), { scale: [0.08, 0.9, 0.9], rotY: yaw });
    if (lit++ < 9) { const g = glow('#ffc978', 5, 0.5), p = at(0, d / 2 + 0.6, 1.5); g.position.copy(p); K.group.add(g); animated.push((dt, t) => { g.material.opacity = 0.42 + 0.08 * Math.sin(t * 3 + x); }); }
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(a * w / 2, b * d / 2, 0));
    for (let i = 0; i < 4; i++) wall(c[i].x, c[i].z, c[(i + 1) % 4].x, c[(i + 1) % 4].z, 0.15, 0, 5);
    K.keepOut.push([x, z, Math.max(w, d) * 0.85]);
  }
  cottage(-11, 12, 1.2, '#b98aa8'); cottage(11, 13, -1.2, '#9a8ac8'); cottage(-13, 2.5, 1.57, '#c8a088'); cottage(-9.5, -8.5, 0.9, '#a898d8');
  cottage(21, 9, -1.57, '#c890a8', 4.4, 4); cottage(9.5, -7, -0.6, '#b9a0d0', 4.6, 4); cottage(-20, -6, 0.9, '#c8a0b8', 4.4, 4);

  // ----- village square: frozen fountain + the Wishing Lantern -----
  add(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 16), toon('#b9c0e8'), V(0, 0.25, 6), { ink: true }); add(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 16), holo(0.9), V(0, 0.5, 6));
  add(G.cyl, toon('#d5dcf7'), V(0, 1.1, 6), { s: [0.22, 1.3, 0.22] }); const fl = add(G.box, flat(WARM), V(0, 2.05, 6), { s: [0.55, 0.7, 0.55], ink: true }), flg = glow('#ffc978', 6, 0.6); flg.position.set(0, 2.05, 6); K.group.add(flg); post(0, 6, 2.5, 0, 2.5);
  animated.push((dt, t) => { fl.rotation.y = t * 0.3; flg.material.opacity = 0.5 + 0.12 * Math.sin(t * 2.5); });

  // ----- Fireplace Library (north): a raised stone hall, open at the front -----
  const LX = 0, LZ = -15, LY = 0.6, W = 14, D = 11, stone = toon('#9a8fc0'), wood = toon('#8a5f78');
  K.slab(LX, 0, LZ, W, LY, D, toon('#b9b0dc'));
  K.stairs(LX, 0, LZ + D / 2 + 1.3, Math.PI, 2, { w: 6, landing: 0.5, cols: ['#c9c0e8', '#d9d2f2'] });
  const lwall = (x, z, w, d, h = 4) => { K.occlude(add(new THREE.BoxGeometry(w, h, d), stone, V(x, LY + h / 2, z), { ink: true })); wall(x - (w > d ? w / 2 : 0), z - (d > w ? d / 2 : 0), x + (w > d ? w / 2 : 0), z + (d > w ? d / 2 : 0), Math.min(w, d) / 2 + 0.05, 0, LY + h); };
  lwall(LX, LZ - D / 2 + 0.25, W, 0.5); lwall(LX - W / 2 + 0.25, LZ, 0.5, D); lwall(LX + W / 2 - 0.25, LZ, 0.5, D);
  lwall(LX - 5.2, LZ + D / 2 - 0.25, 3.6, 0.5); lwall(LX + 5.2, LZ + D / 2 - 0.25, 3.6, 0.5);                                // front wall stubs: a 6.8 m doorway between them
  add(new THREE.BoxGeometry(W + 0.6, 0.5, 0.7), wood, V(LX, LY + 4.25, LZ + D / 2 - 0.25), { ink: true });                    // lintel
  add(roofGeo(W + 1.2, 2.6, 5.5), toon('#6a4a78'), V(LX, LY + 4, LZ - 2.9)); add(roofGeo(W + 1.3, 2.6, 5.3), toon('#f6f9ff'), V(LX, LY + 4.22, LZ - 2.9), { s: [0.95, 1, 1] });   // half roof over the back
  for (const x of [-4.6, 0, 4.6]) add(G.box, wood, V(LX + x, LY + 4.15, LZ + 1.5), { s: [0.3, 0.3, 8] });                     // open rafters over the front
  // hearth
  add(G.box, toon('#7d70a8'), V(LX, LY + 1.4, LZ - D / 2 + 0.8), { s: [3.6, 2.8, 0.8], ink: true }); add(G.box, flat('#2a1d38'), V(LX, LY + 0.9, LZ - D / 2 + 1.22), { s: [2.2, 1.6, 0.06] });
  add(G.box, wood, V(LX, LY + 2.95, LZ - D / 2 + 0.95), { s: [4.2, 0.25, 1.1], ink: true }); post(LX, LZ - D / 2 + 0.9, 1.9, 0, 4);
  const f1 = add(G.cone, flat('#ff9a4a'), V(LX, LY + 0.85, LZ - D / 2 + 1.35), { s: [0.55, 1.3, 0.3] }), f2 = add(G.cone, flat('#ffe08a'), V(LX, LY + 0.65, LZ - D / 2 + 1.42), { s: [0.3, 0.8, 0.2] });
  const fg = glow('#ffa860', 11, 0.6); fg.position.set(LX, LY + 1.3, LZ - D / 2 + 2); K.group.add(fg);
  animated.push((dt, t) => { const k = Math.sin(t * 9) * 0.12 + Math.sin(t * 13.7) * 0.08; f1.scale.y = 1.3 + k; f2.scale.y = 0.8 + k * 0.8; fg.material.opacity = 0.52 + k * 0.4; });
  // bookshelves along both side walls
  const book = new THREE.BoxGeometry(0.14, 0.42, 0.3);
  for (const s of [-1, 1]) for (let b = 0; b < 2; b++) {
    const bx = LX + s * (W / 2 - 0.85), bz = LZ - 2.2 + b * 4.2;
    add(G.box, wood, V(bx, LY + 1.5, bz), { s: [0.7, 3, 3.4], ink: true }); post(bx, bz - 1.1, 0.75, 0, 4); post(bx, bz + 1.1, 0.75, 0, 4);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 16; i++) batch.add('book', book, toon('#ffffff'), V(bx - s * 0.3, LY + 0.5 + row * 0.68 + (R() - 0.5) * 0.05, bz - 1.5 + i * 0.2), { rotY: Math.PI / 2, color: ['#ff9fd6', '#d9b8ff', '#b5d8ff', '#b8ffe9', '#fff3b0', '#ffc7a0'][(i + row * 2 + ((R() * 3) | 0)) % 6] });
  }
  add(new THREE.CylinderGeometry(3.5, 3.5, 0.03, 28), toon('#c86a8a'), V(LX, LY + 0.03, LZ + 0.7)); add(new THREE.CylinderGeometry(2.9, 2.9, 0.03, 28), toon('#ffd9a0'), V(LX, LY + 0.045, LZ + 0.7)); add(new THREE.CylinderGeometry(1.2, 1.2, 0.03, 20), toon('#c86a8a'), V(LX, LY + 0.06, LZ + 0.7));
  K.setCircle({ name: 'Fireplace Library', x: LX, z: LZ + 0.7, y: LY, r: 3.7, seats: K.seats(LX, LY, LZ + 0.7, 2.5, 6, ['#d9737f', '#e8a0b0', '#c890c8', '#ffd9a0'], 0.52), label: V(LX, LY + 7.4, LZ) });

  // ----- Lantern Hill (east, up the steps): the Great Pine -----
  K.mesa(16, 0, -3, 5.5, 1.5, { side: '#c9d2ee', top: SNOW });
  K.stairs(6.3, 0, -3, Math.PI / 2, 5, { w: 3, landing: 0.9, cols: ['#c9c0e8', '#d9d2f2'] });
  K.pine(17.5, 1.5, -3.5, 2.6); const ps = add(G.star, toon(THEME.gold, { emissive: '#ffcf5a', emissiveIntensity: 0.9 }), V(17.5, 1.5 + 9.2, -3.5), { s: [1.6, 2.2, 1.6], ink: true }), pgl = glow('#ffe9a0', 6, 0.7); pgl.position.copy(ps.position); K.group.add(pgl);
  for (let i = 0; i < 9; i++) { const a = i * 2.1, r = 2.6 - i * 0.24, b = add(G.sphere, flat(['#ff9fd6', '#b5d8ff', '#fff3b0', '#b8ffe9'][i % 4]), V(17.5 + Math.cos(a) * r, 3.6 + i * 0.62, -3.5 + Math.sin(a) * r), { s: 0.16 }); animated.push((dt, t) => { b.scale.setScalar(0.14 + 0.05 * Math.sin(t * 3 + i * 2)); }); }
  animated.push((dt, t) => { ps.rotation.y = t * 0.6; });
  // ----- frozen pond (west) with snow people -----
  add(new THREE.CylinderGeometry(5.2, 5.2, 0.05, 26), toon('#f4f8ff'), V(-18, 0.03, 4.5)); add(new THREE.CylinderGeometry(4.7, 4.7, 0.05, 26), holo(0.9), V(-18, 0.05, 4.5));
  function snowman(x, z, col) {
    add(G.sphere, toon('#ffffff'), V(x, 0.55, z), { s: 0.62, ink: true }); add(G.sphere, toon('#ffffff'), V(x, 1.4, z), { s: 0.43, ink: true });
    add(G.cone, toon('#ff9a5a'), V(x, 1.4, z + 0.5), { s: [0.07, 0.3, 0.07], r: [Math.PI / 2, 0, 0] }); for (const s of [-1, 1]) add(G.sphere, flat('#4a2f5e'), V(x + s * 0.15, 1.52, z + 0.38), { s: 0.05 });
    add(new THREE.TorusGeometry(0.34, 0.09, 6, 14), toon(col), V(x, 1.06, z), { r: [Math.PI / 2, 0, 0] }); add(G.cyl, toon('#5d5388'), V(x, 1.92, z), { s: [0.26, 0.36, 0.26], ink: true }); post(x, z, 0.7, 0, 2.2);
  }
  snowman(-13.5, 8.6, '#ff9fd6'); snowman(-22.5, 1.5, '#b5d8ff');

  K.gates(0, 0, 26.5, Math.PI);
  K.keepOut.push([LX, LZ, 10.5], [16, -3, 7.5], [-18, 4.5, 6], [0, 22, 9], [0, 6, 4], [8, -3, 3]);
  const COB = ['#aeb6e0', '#c9cff0'];
  K.path([[0, 0, 22], [0, 0, 9]], '#b9c0e8', COB, 0.62); K.path([[0, 0, 3.4], [0, 0, -7.5]], '#b9c0e8', COB, 0.62); K.path([[-2.5, 0, 6.5], [-10, 0, 7], [-13.5, 0, 5]], '#b9c0e8', COB, 0.62);
  K.path([[2.5, 0, 6.5], [10, 0, 9], [18, 0, 9]], '#b9c0e8', COB, 0.62); K.path([[1.5, 0, 1], [6, 0, -3]], '#b9c0e8', COB, 0.62); K.path([[-2, 0, 2], [-7, 0, -5]], '#b9c0e8', COB, 0.62);
  const lantern = (x, y, z) => K.lamp(x, y, z, { kind: 'lantern', post: '#5d6aa8', color: WARM, glow: '#ffc978', size: 3.4 });
  for (const [x, y, z] of [[-2.2, 0, 18], [2.2, 0, 14], [-2.2, 0, 10.5], [3.4, 0, 2.2], [-3.4, 0, -2.5], [2.6, 0, -6.4], [-6.5, 0, 8.6], [8, 0, 10.6], [14.5, 0, 7.4], [6.6, 0, -1], [13, 1.5, -5.6], [-12, 0, -2]]) lantern(x, y, z);
  for (let i = 0, n = 0; n < 14 && i < 400; i++) { const [x, z] = K.inDisc(0, 0, 6, 28); if (K.free(x, z, 2)) { K.pine(x, 0, z, 0.9 + R() * 0.8); n++; } }
  for (let i = 0, n = 0; n < 7 && i < 200; i++) { const [x, z] = K.inDisc(0, 0, 6, 28); if (K.free(x, z, 2.2)) { K.clump(x, 0, z, 0.8 + R() * 0.6, '#f4f8ff'); n++; } }
  for (let i = 0; i < 4; i++) { const [x, z] = K.inDisc(0, 0, 8, 27); if (K.free(x, z, 1.4)) K.crystal(x, 0, z, 0.7 + R() * 0.4); }
  K.flowers(0, 0, 0, 28, 140, { tuft: '#ffffff', tufts: 1 });                                                                 // little snow tufts
  K.sheen(0, 0, 0, 29, 46, 0.2);

  K.npc('Grandmother Juniper', K.person('princess', 0, 0), V(3.2, 0, 8.8), 1.6, ['Come in out of the snow, dear. The library fire is lit, straight up the lane.', 'Sit by the hearth and stay a while. The circle keeps time for everyone.', 'Lantern Hill is up the steps to the east. Mind the ice.']);
  K.npc('Tobias the Lamplighter', K.person('prince', 5, 2), V(-4, 0, 14), 3, ['Twelve lanterns, lit every dusk. It is always dusk here, so I am always busy.', 'A lantern only helps if you keep walking. Same with a timer.'], 1.3);
  K.npc('Snowdrop', K.animal('kitten', 1.6, '#f79a62'), V(15.5, 1.5, -1), 2, ['Snowdrop the fox sniffs your sleeve, then sneezes.', 'She curls her tail around her paws and watches the aurora.'], 1.5);
  K.thing({ pos: V(0, 0, 6), r: 3.6, label: 'Warm your hands at the lantern', height: 2.2, tag: V(0, 3.2, 6), fx: 16, use: () => 'Your fingers thaw. Good. You will need them for note-taking.' });
  K.thing({ pos: V(-13.5, 0, 8.6), r: 2.2, label: 'Greet the snow person', height: 2.2, tag: V(-13.5, 2.9, 8.6), use: (i) => ['It says nothing. It is an excellent listener.', 'You straighten its hat. It seems grateful.'][(i.n = (i.n || 0) + 1) % 2] });
  K.thing({ pos: V(17.5, 1.5, -3.5), r: 3.4, label: 'Look up at the Great Pine', height: 4, tag: V(17.5, 6.5, -3.5), fx: 22, use: () => 'Nine little lights and a star. Above them, the aurora folds like a curtain.' });

  return K.finish({
    spawn: V(0, 0, 17),
    env: { sky: { day: ['#0b1040', '#222a74', '#4b3f90'] }, cycle: false, stars: 1, moon: true, aurora: 1, glow: 0.5, sunDir: [-0.45, 0.5, -0.74],
      fog: { day: '#2a3272', near: 14, far: 92 }, hemi: ['#b6beff', '#6a70b0', 1.05], sun: ['#dfe6ff', 0.75],
      weather: { kind: 'snow', vel: [0.35, -1.5, 0.15], size: 0.17, color: '#ffffff', sway: 0.45, n: 520, box: [44, 22, 44] },
      sparkle: [[0, 0, 0, 28, 5]], sparkleCol: '#dfe9ff' },
  });
}
