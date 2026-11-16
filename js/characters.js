/* ============================================================
   characters.js — chibi avatars, pet companions and NPCs.
   Everything is drawn from shapes with a soft ink outline
   (FN.THEME.ink), with (x, y) at the feet.

   Animation is all procedural, driven by `time` (seconds):
   idle breathing + blink, walk bounce with squash/stretch,
   hair / cape / dress sway that trails behind when moving.
   ============================================================ */
(function (FN) {
  'use strict';
  const FX = FN.FX, T = FN.THEME, TAU = Math.PI * 2;

  // ---------- choices offered on the character select screen ----------
  FN.KINDS = ['princess', 'prince', 'mermaid', 'fairy'];
  FN.PETS = ['kitten', 'puppy', 'bunny', 'pegasus'];
  FN.PET_LABEL = { kitten: 'Kitten', puppy: 'Puppy', bunny: 'Bunny', pegasus: 'Baby winged horse' };
  FN.SCHEMES = [
    { name: 'Rose', main: '#ff9fcf', accent: '#fff0a8', hair: '#9a5a4a' },
    { name: 'Lilac', main: '#c9adff', accent: '#ffe6f7', hair: '#6a4a9a' },
    { name: 'Mint', main: '#9fecd0', accent: '#ffd1e8', hair: '#f4c95d' },
    { name: 'Sky', main: '#a6d4ff', accent: '#ffffff', hair: '#4a4670' },
    { name: 'Sunbeam', main: '#ffdc8f', accent: '#ffa6c4', hair: '#d06a48' },
    { name: 'Midnight', main: '#8088e0', accent: '#fff0a8', hair: '#2c2850' },
  ];
  FN.SKINS = ['#ffe6d6', '#f6cdaa', '#cf966c', '#93613f'];

  // ---------- fairy-tale name generator ----------
  const FIRST = ['Rosalind', 'Elowen', 'Caspian', 'Marisol', 'Thistle', 'Lysander', 'Ondine', 'Briar', 'Isolde', 'Peregrine',
    'Wren', 'Lucian', 'Coralie', 'Fenwick', 'Seraphine', 'Alaric', 'Juniper', 'Linnea', 'Evander', 'Clementine'];
  FN.randomName = () => {
    const z = FN.ZONES[FN.ZONE_ORDER[Math.floor(Math.random() * FN.ZONE_ORDER.length)]];
    return FIRST[Math.floor(Math.random() * FIRST.length)] + ' of ' + z.name.replace('Moonlit ', 'the ').replace('Coral ', 'the ');
  };

  // ---------- outlined shape helpers (lw = 0 skips the outline) ----------
  const E = (c, x, y, rx, ry, fill, rot, lw) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = fill; c.fill(); if (lw !== 0) FX.ink(c, lw || 1.4); };
  const R = (c, x, y, w, h, r, fill, lw) => { FN.rr(c, x, y, w, h, r, fill); if (lw !== 0) FX.ink(c, lw || 1.4); };
  const P = (c, fill, lw) => { c.closePath(); c.fillStyle = fill; c.fill(); if (lw !== 0) FX.ink(c, lw || 1.4); };

  // ============================================================
  //  AVATAR      a = { kind, scheme, skin }
  //  moving = walk loop vs idle loop,  dir = 1 (facing right) / -1
  // ============================================================
  FN.drawAvatar = (c, a, x, y, time, moving, dir, scale) => {
    const sc = FN.SCHEMES[a.scheme] || FN.SCHEMES[0], skin = FN.SKINS[a.skin] || FN.SKINS[0];
    const floaty = a.kind === 'fairy' || a.kind === 'mermaid';
    const walk = moving ? Math.sin(time * 11) : 0, idle = Math.sin(time * 2.4);
    const hopY = floaty ? -8 + Math.sin(time * 3) * 2.5 : (moving ? -Math.abs(Math.sin(time * 11)) * 3.5 : 0);
    const stretch = 1 + (moving ? Math.sin(time * 22) * 0.035 : idle * 0.022);          // squash & stretch
    const sway = moving ? -2.4 + Math.sin(time * 11) * 1.1 : Math.sin(time * 1.8) * 1.1;   // hair / cloth trail behind
    const blink = (time * 0.31 + (a.scheme || 0) * 0.37) % 1 > 0.955;
    scale = scale || 1;

    c.save(); c.translate(x, y);
    FX.shadow(c, 0, 0, (16 + hopY * 0.4) * scale, 5 * scale);
    c.scale(dir * scale / stretch, scale * stretch); c.translate(0, hopY);

    // ----- behind the body -----
    if (a.kind === 'fairy') {                                             // iridescent wings
      const flap = 0.5 + 0.5 * Math.abs(Math.sin(time * 14));
      c.globalAlpha = 0.82;
      for (const s of [-1, 1]) {
        c.beginPath(); c.ellipse(s * 12 * flap, -36, 11 * flap + 1, 16, s * 0.5, 0, TAU); c.fillStyle = FX.holo(c, -24, -52, 24, -20, time * 0.2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.ellipse(s * 10 * flap, -21, 7 * flap + 1, 9, s * 0.9, 0, TAU); c.fillStyle = sc.accent; c.fill(); c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (a.kind === 'prince') {                                            // cape
      c.beginPath(); c.moveTo(-7, -32); c.quadraticCurveTo(-13 + sway, -18, -14 + sway * 2, -5); c.lineTo(8 + sway * 1.5, -6); c.lineTo(7, -32); P(c, sc.accent);
    } else {                                                              // long hair, tips sway
      c.beginPath(); c.moveTo(-15, -45); c.quadraticCurveTo(-20 + sway, -30, -16 + sway * 1.8, -16);
      c.quadraticCurveTo(-9 + sway * 1.8, -12, -3 + sway, -19); c.lineTo(9, -21); c.quadraticCurveTo(17, -31, 15, -45); P(c, sc.hair);
    }

    // ----- legs / shoes -----
    if (a.kind === 'prince' || a.kind === 'fairy') {
      const col = a.kind === 'prince' ? '#5d5388' : skin;
      R(c, -6 + walk * 2.6, -12, 4.8, 11, 2.2, col); R(c, 1.4 - walk * 2.6, -12, 4.8, 11, 2.2, col);
      E(c, -3 + walk * 2.6, -1, 3.8, 2.4, a.kind === 'prince' ? '#7a5a4a' : sc.accent); E(c, 4.4 - walk * 2.6, -1, 3.8, 2.4, a.kind === 'prince' ? '#7a5a4a' : sc.accent);
    } else if (a.kind === 'princess') {
      E(c, -4 + walk * 2.4, -1.5, 3.4, 2.2, sc.accent); E(c, 5 - walk * 2.4, -1.5, 3.4, 2.2, sc.accent);
    }

    // ----- body -----
    const hem = -sway * 0.7;                                              // skirt swings opposite to the hair
    if (a.kind === 'princess') {
      c.beginPath(); c.moveTo(-6, -25); c.quadraticCurveTo(-13 + hem * 0.5, -15, -17 + hem, -5);
      for (let i = 0; i < 4; i++) { const x0 = -17 + hem + i * 8.5; c.quadraticCurveTo(x0 + 4.25, -0.5, x0 + 8.5, -5); }
      c.quadraticCurveTo(13 + hem * 0.5, -15, 6, -25); P(c, sc.main);
      FX.gloss(c, -6 + hem * 0.5, -13, 3, 7, 0.35, 0.4);
      for (let i = 0; i < 3; i++) FX.star(c, -8 + i * 8 + hem * 0.7, -8, 1.8, sc.accent, 0);
      R(c, -6.5, -32, 13, 9, 4, sc.main);
      c.beginPath(); c.moveTo(0, -24); c.lineTo(-6, -27); c.lineTo(-6, -21); c.closePath(); c.moveTo(0, -24); c.lineTo(6, -27); c.lineTo(6, -21); P(c, sc.accent, 1); // bow
    } else if (a.kind === 'prince') {
      R(c, -7.5, -32, 15, 21, 5, sc.main); FX.gloss(c, -3.5, -25, 2, 5, 0.2, 0.4);
      c.fillStyle = sc.accent; c.fillRect(-7, -17, 14, 3); E(c, 0, -15.5, 2, 2, '#ffe07a', 0, 1);
      for (const by of [-28, -23]) E(c, 0, by, 1, 1, '#ffffff', 0, 0);
    } else if (a.kind === 'mermaid') {
      const wig = Math.sin(time * (moving ? 9 : 3)) * 3.5;
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(2 + wig + s * 5.5, -1.5, 7.5, 3.8, s * 0.65, 0, TAU); c.fillStyle = sc.accent; c.fill(); FX.ink(c, 1.3); }
      c.beginPath(); c.moveTo(-7, -22); c.lineTo(7, -22); c.quadraticCurveTo(10, -9, 2 + wig, -3); c.quadraticCurveTo(-6, -9, -7, -22); P(c, sc.main);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-2 + i * 2.5, -17 + i * 4, 2.6, 0.2, Math.PI - 0.2); c.stroke(); }
      R(c, -6.5, -32, 13, 11, 4.5, skin);
      E(c, -3, -27, 3.2, 2.8, sc.accent, 0, 1); E(c, 3, -27, 3.2, 2.8, sc.accent, 0, 1);                       // shell top
    } else {                                                              // fairy: petal dress
      for (let i = -2; i <= 2; i++) E(c, i * 4.6 + hem * 0.5, -13 + Math.abs(i), 4.2, 7, i % 2 ? sc.accent : sc.main, i * 0.32 + hem * 0.03);
      R(c, -6, -32, 12, 12, 4.5, sc.main);
      c.fillStyle = sc.accent; c.fillRect(-6, -23.5, 12, 2.5);
    }
    E(c, -8.6, -24 + walk * 1.8, 2.7, 4.2, skin, 0.35); E(c, 8.6, -24 - walk * 1.8, 2.7, 4.2, skin, -0.35);   // arms

    // ----- head -----
    E(c, 0, -43.5, 15.5, 15, sc.hair);
    E(c, 0.5, -41.5, 13, 12.5, skin);
    c.beginPath(); c.arc(0.5, -41.5, 13.4, Math.PI * 1.02, -0.06); c.quadraticCurveTo(9, -47, 4, -49.5); c.quadraticCurveTo(-2, -44.5, -12.9, -41.5); P(c, sc.hair);   // fringe
    if (a.kind !== 'prince') E(c, -12.5 + sway * 0.3, -36, 3.2, 6.5, sc.hair, 0.15);                           // side lock
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.arc(0, -43.5, 11.5, -2.3, -1.5); c.stroke();   // hair shine
    // face
    for (const ex of [-2.2, 7]) {
      E(c, ex, -39.5, 2.4, blink ? 0.5 : 3.3, '#4a2f5e', 0, 0);
      if (!blink) { E(c, ex + 0.8, -40.9, 1, 1.1, '#ffffff', 0, 0); E(c, ex - 0.7, -38.1, 0.55, 0.55, '#ffd9f0', 0, 0); }
    }
    E(c, -6, -35.3, 2.9, 1.7, 'rgba(255,120,160,.42)', 0, 0); E(c, 10.5, -35.3, 2.5, 1.7, 'rgba(255,120,160,.42)', 0, 0);
    if (moving) { c.beginPath(); c.arc(2.6, -36, 2.3, 0, Math.PI); c.closePath(); c.fillStyle = '#e06a92'; c.fill(); }
    else { c.strokeStyle = '#b0607a'; c.lineWidth = 1.2; c.beginPath(); c.arc(2.6, -36.4, 2.1, 0.25, Math.PI - 0.25); c.stroke(); }

    // ----- accessory -----
    if (a.kind === 'princess' || a.kind === 'prince') {                   // crown
      const w = a.kind === 'prince' ? 8 : 6.5;
      c.beginPath(); c.moveTo(-w, -53); c.lineTo(-w - 0.5, -60); c.lineTo(-w / 2, -56.5); c.lineTo(0, -62); c.lineTo(w / 2, -56.5); c.lineTo(w + 0.5, -60); c.lineTo(w, -53); P(c, '#ffe07a', 1.2);
      E(c, 0, -56, 1.6, 1.6, sc.main, 0, 0); E(c, -w - 0.5, -60.5, 1.2, 1.2, '#fff', 0, 0); E(c, w + 0.5, -60.5, 1.2, 1.2, '#fff', 0, 0);
    } else if (a.kind === 'mermaid') {                                    // star clip + pearl
      FX.star(c, -9, -51, 5.5, sc.accent, time * 0.5); FX.ink(c, 1); E(c, -3.5, -54.5, 1.8, 1.8, '#ffffff', 0, 1);
    } else {                                                              // antennae + flower
      c.strokeStyle = T.ink; c.lineWidth = 1.3;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 3, -56); c.quadraticCurveTo(s * 4.5 + sway * 0.4, -62, s * 8 + sway * 0.6, -64); c.stroke(); E(c, s * 8 + sway * 0.6, -64, 2.2, 2.2, sc.accent, 0, 1); }
      for (let i = 0; i < 5; i++) E(c, 9 + Math.cos(i * 1.257) * 2.6, -51 + Math.sin(i * 1.257) * 2.6, 1.9, 1.9, sc.accent, 0, 0);
      E(c, 9, -51, 1.4, 1.4, '#fff3a8', 0, 0);
    }
    c.restore();
  };

  // ============================================================
  //  PETS  (also reused, scaled up, for animal NPCs and sky flyers)
  // ============================================================
  const PET_STYLE = {
    kitten: { body: '#ffd29c', ear: 'point', tail: 'curl' },
    puppy: { body: '#e6b78c', ear: 'flop', tail: 'wag', dark: '#b3744a' },
    bunny: { body: '#fffaf5', ear: 'long', tail: 'puff' },
    pegasus: { body: '#ffffff', ear: 'point', tail: 'flow', mane: '#ff9fd6', wings: true, snout: true },
    fox: { body: '#f79a62', ear: 'point', tail: 'bush' },
    hedgehog: { body: '#f4e0c6', ear: 'none', tail: 'none', spikes: '#8f6f5c' },
  };
  // fly = true tucks the legs and flaps harder (used for the sky pegasi)
  FN.drawPet = (c, type, x, y, time, moving, dir, scale, color, fly) => {
    const st = PET_STYLE[type] || PET_STYLE.kitten, body = color || st.body;
    const walk = moving ? Math.sin(time * 13) : 0;
    const hop = fly ? 0 : moving ? -Math.abs(Math.sin(time * (type === 'bunny' ? 9 : 11))) * (type === 'bunny' ? 7 : 3.5) : Math.sin(time * 2.2) * 0.6;
    const stretch = 1 + (moving && !fly ? Math.sin(time * 22) * 0.05 : Math.sin(time * 2.2) * 0.02);
    scale = scale || 1;
    c.save(); c.translate(x, y);
    if (!fly) FX.shadow(c, 0, 0, (11 + hop * 0.5) * scale, 3.6 * scale);
    c.scale(dir * scale / stretch, scale * stretch); c.translate(0, hop);
    c.lineCap = 'round';

    // tail
    const tailLine = (col, w, pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); c.strokeStyle = T.ink; c.lineWidth = w + 2.4; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
    if (st.tail === 'curl') tailLine(body, 3.2, [-9, -8, -17, -10, -14, -20 + walk]);
    if (st.tail === 'wag') tailLine(st.dark, 2.8, [-9, -10, -12, -13, -14 + Math.sin(time * 16) * 2.5, -18]);
    if (st.tail === 'puff') E(c, -10.5, -9, 4, 4, '#ffffff');
    if (st.tail === 'flow') tailLine(st.mane, 3.4, [-9, -10, -18, -9 + walk, -16, 1 + walk]);
    if (st.tail === 'bush') { tailLine(body, 7, [-9, -8, -14, -11, -19, -12 + walk]); E(c, -20, -12 + walk, 3, 3, '#fff', 0, 0); }
    // legs
    if (!fly) for (const [lx, ph] of [[-7, 1], [-3, -1], [3, 1], [7, -1]]) R(c, lx - 1.6 + walk * ph * 1.7, -5.5, 3.2, 5.5, 1.5, st.dark || body, 1.2);
    else { E(c, -5, -3, 3.4, 2, body, 0.5, 1.2); E(c, 5, -3, 3.4, 2, body, -0.5, 1.2); }
    // body + spikes / wings
    E(c, 0, -9, 10.5, 7.2, body);
    FX.gloss(c, -3, -12.5, 4, 1.6, -0.2, 0.6);
    if (st.spikes) {
      c.beginPath(); c.ellipse(-1.5, -10, 10.5, 8.5, 0, Math.PI * 0.95, Math.PI * 1.95); P(c, st.spikes);
      c.strokeStyle = st.spikes; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = Math.PI * (1.05 + i * 0.16); c.beginPath(); c.moveTo(-1.5 + Math.cos(a) * 9, -10 + Math.sin(a) * 7); c.lineTo(-1.5 + Math.cos(a) * 14, -10 + Math.sin(a) * 11); c.stroke(); }
    }
    if (st.wings) {
      const f = Math.sin(time * (fly ? 9 : moving ? 12 : 3)) * (fly ? 0.7 : 0.35);
      c.beginPath(); c.ellipse(-2, -17.5, 9.5, 4.8, -0.6 + f, 0, TAU); c.fillStyle = FX.holo(c, -12, -24, 8, -10, time * 0.15); c.fill(); FX.ink(c, 1.2);
      E(c, -3, -15.5, 6, 3, '#ffffff', -0.4 + f, 1);
    }
    // head
    if (st.snout) tailLine(st.mane, 3.4, [5, -21, 1.5, -14, 5, -9]);
    if (st.ear === 'long') { const w = Math.sin(time * 3) * 0.08; E(c, 6, -26, 2.8, 8.5, body, -0.15 + w); E(c, 11, -26, 2.8, 8.5, body, 0.15 + w); E(c, 11, -26, 1.1, 5.5, '#ffb8d6', 0.15 + w, 0); }
    if (st.ear === 'point') { c.beginPath(); c.moveTo(3.5, -18); c.lineTo(5.5, -25.5); c.lineTo(9, -19); P(c, body, 1.3); c.beginPath(); c.moveTo(10, -19); c.lineTo(13.2, -25.5); c.lineTo(15, -17); P(c, body, 1.3); }
    E(c, 9, -14, 7.2, 6.7, body);
    if (st.snout) E(c, 14.8, -12, 4.8, 3.7, body);
    if (st.ear === 'flop') E(c, 4.6, -13, 3, 6.2, st.dark, 0.3);
    E(c, 11.4, -15, 1.5, 1.9, '#4a2f5e', 0, 0); E(c, 11.9, -15.7, 0.6, 0.6, '#fff', 0, 0);
    E(c, st.snout ? 18.4 : 15.5, st.snout ? -12 : -12.6, 1.1, 0.9, st.snout ? '#e7a8c0' : '#c0607a', 0, 0);
    E(c, 8.3, -11.3, 2, 1.3, 'rgba(255,120,160,.4)', 0, 0);
    c.restore();
  };

  // Old Barnaby the crab: scuttles sideways.
  FN.drawCrab = (c, x, y, time, moving) => {
    const w = moving ? Math.sin(time * 16) : 0, ell = FN.ell;
    c.save(); c.translate(x, y);
    FX.shadow(c, 0, 0, 20, 5);
    c.strokeStyle = '#e8705f'; c.lineWidth = 3; c.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 10, -8 + i * 3); c.lineTo(s * (19 + i * 2), -3 + i * 2 + w * s * (i % 2 ? 2 : -2)); c.stroke(); }
    E(c, 0, -11, 16, 10, '#ff8f7a'); ell(c, -4, -14, 6, 3, 'rgba(255,255,255,.3)');
    for (const s of [-1, 1]) {
      c.strokeStyle = '#e8705f'; c.lineWidth = 3; c.beginPath(); c.moveTo(s * 12, -14); c.lineTo(s * 20, -22 - w * 1.5); c.stroke(); E(c, s * 22, -25 - w * 1.5, 6, 5, '#ff8f7a');
      c.strokeStyle = '#e8705f'; c.lineWidth = 2; c.beginPath(); c.moveTo(s * 5, -19); c.lineTo(s * 6, -25); c.stroke();
      E(c, s * 6, -26, 2.8, 2.8, '#fff', 0, 1); ell(c, s * 6 + 0.5, -26, 1.2, 1.2, '#4a2f5e');
    }
    c.restore();
  };

  // ============================================================
  //  NPCs — their path is a pure function of the clock, so every
  //  visitor sees them in the same place without any networking.
  //  Loop: walk to a random nearby point (60%), then idle (40%).
  // ============================================================
  const SEG = 7000;                                   // ms per walk+idle cycle
  FN.npcState = (zone, npc, index, now) => {
    const seed = zone.seed * 31 + index * 97, i = Math.floor(now / SEG) + index * 3;
    const pt = (k) => FN.clampToZone(zone,
      npc.home[0] + (FN.hash(seed + k * 2.3) - 0.5) * 2 * npc.range,
      npc.home[1] + (FN.hash(seed + k * 5.1 + 9) - 0.5) * 1.4 * npc.range);
    const a = pt(i), b = pt(i + 1);
    let f = FN.clamp(((now % SEG) / SEG) / 0.6, 0, 1);
    const moving = f > 0 && f < 1;
    f = f * f * (3 - 2 * f);                          // ease in/out
    return { x: FN.lerp(a.x, b.x, f), y: FN.lerp(a.y, b.y, f), moving, dir: b.x >= a.x ? 1 : -1 };
  };
  FN.drawNpc = (c, npc, s, time) => {
    if (npc.kind === 'avatar') FN.drawAvatar(c, npc.a, s.x, s.y, time, s.moving, s.dir, 1.08);
    else if (npc.kind === 'crab') FN.drawCrab(c, s.x, s.y, time, s.moving);
    else FN.drawPet(c, npc.pet, s.x, s.y, time, s.moving, s.dir, npc.scale, npc.color);
  };
  FN.npcHeight = (npc) => (npc.kind === 'avatar' ? 72 : npc.kind === 'crab' ? 40 : 30 * (npc.scale || 1));
})(window.FN);
