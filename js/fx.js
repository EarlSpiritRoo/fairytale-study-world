/* ============================================================
   fx.js — the SHARED STYLE SYSTEM ("magical Y2K kit").
   Every zone, character and canvas label draws through this,
   so restyling the world means editing one file.

   THEME        colour + font tokens (holo palette, ink outline…)
   FX.*         drawing helpers: holo / pearl / chrome fills,
                ✦ stars, hearts, soft shadows, jelly plaques
   FX.emit      capped world-space particle pool (sparkles, hearts)
   FX.Sky       layered parallax backdrop with day→sunset cycle
   FX.critters  butterflies
   FX.flare     lens flare (the vignette is plain CSS: #vignette)

   A zone opts in with plain data, e.g.
     sky: { day: [...], sunset: [...] }, ambient: { butterflies: 8, hearts: true }
   ============================================================ */
(function (FN) {
  'use strict';

  // ---------- design tokens ----------
  const T = FN.THEME = {
    holo: ['#ffb3e6', '#d9b8ff', '#b5d8ff', '#b8ffe9', '#fff3b0'],   // pink · lilac · baby blue · mint · butter
    ink: '#6b4a8a',                        // outline colour for characters and props
    shadow: 'rgba(92,70,150,.20)',         // soft contact shadow under everything
    pearl: ['#ffffff', '#fdeeff', '#e3ecff'],
    chrome: ['#ffffff', '#d5dcf7', '#96a2d6', '#f4f6ff'],
    glow: { pink: '255,170,230', blue: '170,215,255', gold: '255,236,170', mint: '180,255,230', white: '255,255,255', lilac: '215,185,255' },
    fontDisplay: "'Bagel Fat One', 'Fredoka', sans-serif",
    fontLabel: "'Fredoka', 'Nunito', sans-serif",
  };
  const FX = FN.FX = {};
  const TAU = Math.PI * 2;

  // ---------- colour maths ----------
  const hexCache = {};
  const rgb = (h) => hexCache[h] || (hexCache[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  FX.mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return `rgb(${Math.round(p[0] + (q[0] - p[0]) * t)},${Math.round(p[1] + (q[1] - p[1]) * t)},${Math.round(p[2] + (q[2] - p[2]) * t)})`; };

  // ---------- material fills ----------
  // Iridescent gradient between two points. `shift` (0..1) slides the colours — animate it for shimmer.
  FX.holo = (c, x0, y0, x1, y1, shift) => {
    const s = ((shift || 0) % 1 + 1) % 1, dx = x1 - x0, dy = y1 - y0, n = T.holo.length;
    const g = c.createLinearGradient(x0 - dx * s, y0 - dy * s, x1 + dx * (1 - s), y1 + dy * (1 - s));
    for (let i = 0; i <= n * 2; i++) g.addColorStop(i / (n * 2), T.holo[i % n]);
    return g;
  };
  FX.pearl = (c, x, y, r) => {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fdeeff'); g.addColorStop(0.85, '#dfe6ff'); g.addColorStop(1, '#f6d9f2');
    return g;
  };
  FX.chrome = (c, y0, y1) => {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#d5dcf7'); g.addColorStop(0.55, '#96a2d6'); g.addColorStop(1, '#f4f6ff');
    return g;
  };

  // ---------- shapes ----------
  FX.shadow = (c, x, y, rx, ry) => FN.ell(c, x, y, rx, ry == null ? rx * 0.32 : ry, T.shadow);
  FX.gloss = (c, x, y, rx, ry, rot, a) => FN.ell(c, x, y, rx, ry, `rgba(255,255,255,${a == null ? 0.55 : a})`, rot);
  FX.ink = (c, w) => { c.lineWidth = w || 1.5; c.strokeStyle = T.ink; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
  // four-point sparkle ✦
  FX.star = (c, x, y, r, fill, rot) => {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (rot || 0) + i * Math.PI / 4, k = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    c.closePath(); c.fillStyle = fill; c.fill();
  };
  FX.heart = (c, x, y, r, fill) => {
    c.beginPath(); c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.1, x, y - r * 0.35);
    c.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); }
  };
  // glossy translucent "jelly" plaque — canvas twin of the CSS .jelly look
  FX.jelly = (c, x, y, w, h, r, top, bottom) => {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top || 'rgba(255,255,255,.92)'); g.addColorStop(1, bottom || 'rgba(244,226,255,.88)');
    FN.rr(c, x, y, w, h, r, g);
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.5; c.stroke();
    FN.rr(c, x + r * 0.5, y + 1.5, w - r, Math.min(h * 0.42, 14), r, 'rgba(255,255,255,.6)');
  };

  // ============================================================
  //  PARTICLE POOL (world space, hard-capped)
  //  FX.emit('spark' | 'heart' | 'dot', x, y, { n, spread, col, size, up })
  // ============================================================
  const MAX = 150, pool = [];
  FX.emit = (type, x, y, o) => {
    o = o || {};
    for (let i = 0; i < (o.n || 1); i++) {
      const a = Math.random() * TAU, sp = (o.spread || 0) * (0.4 + Math.random() * 0.6), life = (o.life || 0.9) * (0.7 + Math.random() * 0.6);
      const p = { type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - (o.up || 0), life, max: life, size: (o.size || 5) * (0.6 + Math.random() * 0.7), col: o.col || T.holo[(Math.random() * 5) | 0], rot: Math.random() * TAU };
      if (pool.length < MAX) pool.push(p); else pool[(Math.random() * MAX) | 0] = p;
    }
  };
  FX.burst = (x, y, n) => { FX.emit('spark', x, y, { n: n || 8, spread: 90, up: 30, size: 6 }); FX.emit('dot', x, y, { n: 4, spread: 60, up: 20, size: 2.5, col: '#ffffff' }); };
  FX.clearParticles = () => { pool.length = 0; };
  FX.drawParticles = (c, dt) => {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i]; p.life -= dt;
      if (p.life <= 0) { pool[i] = pool[pool.length - 1]; pool.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2.5 * dt; p.vy = p.vy * (1 - 2.5 * dt) - (p.type === 'heart' ? 14 : 5) * dt; p.rot += dt * 2;
      const k = p.life / p.max; c.globalAlpha = Math.min(1, k * 2);
      if (p.type === 'spark') FX.star(c, p.x, p.y, p.size * (0.5 + k * 0.5), p.col, p.rot);
      else if (p.type === 'heart') { FX.heart(c, p.x + Math.sin(p.rot * 2) * 3, p.y, p.size, p.col); FN.ell(c, p.x - p.size * 0.35 + Math.sin(p.rot * 2) * 3, p.y - p.size * 0.3, p.size * 0.22, p.size * 0.16, 'rgba(255,255,255,.8)'); }
      else FN.ell(c, p.x, p.y, p.size * k, p.size * k, p.col);
    }
    c.globalAlpha = 1;
  };

  // ============================================================
  //  CRITTERS — butterflies that drift between random points
  // ============================================================
  let flies = [];
  FX.makeCritters = (zone) => {
    flies = [];
    const n = (zone.ambient && zone.ambient.butterflies) || 0;
    for (let i = 0; i < n; i++) { const x = 300 + Math.random() * 1000, y = 300 + Math.random() * 500; flies.push({ x, y, tx: x, ty: y, hx: x, hy: y, ph: Math.random() * 6, col: i % T.holo.length }); }
  };
  FX.drawCritters = (c, dt, t) => {
    for (const b of flies) {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 8) { b.tx = b.hx + (Math.random() - 0.5) * 360; b.ty = b.hy + (Math.random() - 0.5) * 240; }
      else { b.x += dx / d * 42 * dt + Math.sin(t * 3 + b.ph) * 0.5; b.y += dy / d * 42 * dt + Math.cos(t * 4 + b.ph) * 0.6; }
      const flap = Math.abs(Math.sin(t * 13 + b.ph)), y = b.y - 34 + Math.sin(t * 5 + b.ph) * 4;
      FX.shadow(c, b.x, b.y, 6, 2);
      for (const s of [-1, 1]) {
        c.beginPath(); c.ellipse(b.x + s * 5 * flap, y - 2, 6 * flap + 0.6, 7, s * 0.4, 0, TAU); c.fillStyle = T.holo[b.col]; c.fill(); FX.ink(c, 0.9);
        c.beginPath(); c.ellipse(b.x + s * 4 * flap, y + 5, 4 * flap + 0.5, 4.5, s * -0.4, 0, TAU); c.fillStyle = T.holo[(b.col + 1) % 5]; c.fill(); FX.ink(c, 0.9);
      }
      FN.rr(c, b.x - 1, y - 6, 2, 12, 1, T.ink);
    }
  };
  // occasional floating hearts / twinkles somewhere in view
  FX.ambient = (zone, cam, viewW, viewH, dt) => {
    if (!zone.ambient || !zone.ambient.hearts) return;
    if (Math.random() < dt * 0.9) FX.emit('heart', cam.x + Math.random() * viewW, cam.y + Math.random() * viewH, { size: 7, life: 2.6, up: 22, col: Math.random() < 0.5 ? '#ff9fd6' : '#d9b8ff' });
    if (Math.random() < dt * 2.2) FX.emit('spark', cam.x + Math.random() * viewW, cam.y + Math.random() * viewH, { size: 6, life: 1.3, up: 6 });
  };

  // ============================================================
  //  FLOATING ISLET (used in the far sky and in the world)
  // ============================================================
  FX.islet = (c, x, y, s, seed, t, gate) => {
    const g = c.createLinearGradient(0, y, 0, y + 95 * s); g.addColorStop(0, '#e6d5ff'); g.addColorStop(0.6, '#c6b2ff'); g.addColorStop(1, '#ffc4e6');
    c.beginPath(); c.moveTo(x - 62 * s, y); c.quadraticCurveTo(x - 42 * s, y + 52 * s, x - 6 * s, y + 94 * s); c.quadraticCurveTo(x + 36 * s, y + 50 * s, x + 62 * s, y); c.closePath(); c.fillStyle = g; c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x - 30 * s, y + 6 * s); c.lineTo(x - 8 * s, y + 80 * s); c.lineTo(x - 2 * s, y + 6 * s); c.closePath(); c.fill();
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(x + k * 26 * s, y + 40 * s); c.lineTo(x + k * 20 * s, y + 68 * s); c.lineTo(x + k * 14 * s, y + 44 * s); c.closePath(); c.fillStyle = '#b5d8ff'; c.fill(); }
    if (seed % 2) {                                    // cloud waterfall off the side
      const wg = c.createLinearGradient(0, y, 0, y + 110 * s); wg.addColorStop(0, 'rgba(255,255,255,.95)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = wg; c.fillRect(x + 30 * s, y, 14 * s, 110 * s);
      for (let i = 0; i < 3; i++) FN.ell(c, x + 37 * s, y + ((t * 60 + i * 37) % 100) * s, 4 * s, 7 * s, 'rgba(255,255,255,.7)');
    }
    FN.ell(c, x - 50 * s, y + 3 * s, 20 * s, 13 * s, '#fff'); FN.ell(c, x + 52 * s, y + 4 * s, 18 * s, 12 * s, '#fff');
    FN.ell(c, x, y, 64 * s, 19 * s, '#ffffff'); FN.ell(c, x, y - 3 * s, 55 * s, 14 * s, '#c4f3dc');
    if (gate) {                                        // star gate: where a rainbow bridge lands
      c.lineWidth = 7 * s; c.strokeStyle = FX.chrome(c, y - 80 * s, y); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 26 * s, y - 2 * s); c.quadraticCurveTo(x - 28 * s, y - 74 * s, x, y - 76 * s); c.quadraticCurveTo(x + 28 * s, y - 74 * s, x + 26 * s, y - 2 * s); c.stroke();
      c.fillStyle = FX.holo(c, x - 20 * s, y - 70 * s, x + 20 * s, y, t * 0.15); c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(x - 21 * s, y - 2 * s); c.quadraticCurveTo(x - 22 * s, y - 68 * s, x, y - 70 * s); c.quadraticCurveTo(x + 22 * s, y - 68 * s, x + 21 * s, y - 2 * s); c.closePath(); c.fill(); c.globalAlpha = 1;
      FX.star(c, x, y - 84 * s, 11 * s, '#fff3b0', t * 0.6);
    } else if (seed % 3 === 0) {                       // crystal
      c.beginPath(); c.moveTo(x - 9 * s, y - 4 * s); c.lineTo(x - 3 * s, y - 40 * s); c.lineTo(x + 8 * s, y - 4 * s); c.closePath(); c.fillStyle = FX.holo(c, x - 10 * s, y - 40 * s, x + 10 * s, y, seed * 0.13); c.fill();
      c.beginPath(); c.moveTo(x + 6 * s, y - 3 * s); c.lineTo(x + 16 * s, y - 24 * s); c.lineTo(x + 20 * s, y - 3 * s); c.closePath(); c.fillStyle = '#d9b8ff'; c.fill();
    } else {                                           // blossom tree
      FN.rr(c, x - 3 * s, y - 26 * s, 6 * s, 24 * s, 2, '#b08ac0');
      FN.ell(c, x - 12 * s, y - 32 * s, 15 * s, 13 * s, '#ffc2e4'); FN.ell(c, x + 12 * s, y - 33 * s, 15 * s, 13 * s, '#ffc2e4'); FN.ell(c, x, y - 44 * s, 17 * s, 15 * s, '#ffd3ec');
    }
  };

  // ============================================================
  //  SKY — parallax backdrop with a slow day → sunset → day cycle.
  //  The cycle follows the wall clock, so every visitor sees the
  //  same sky. cfg = zone.sky = { day: [3 colours], sunset: [3] }
  // ============================================================
  const CYCLE = 240000;                                // ms for one full day→sunset→day loop
  FX.sunset = (now) => 0.5 - 0.5 * Math.cos((now % CYCLE) / CYCLE * TAU);     // 0 = day, 1 = sunset
  const mod = (a, n) => ((a % n) + n) % n;

  const cloudSprites = [];
  function makeCloudSprites() {
    for (let k = 0; k < 3; k++) {
      const cv = document.createElement('canvas'); cv.width = 280; cv.height = 140;
      const g = cv.getContext('2d'), r = FN.rng(77 + k * 13);
      const gr = g.createLinearGradient(0, 10, 0, 130); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#fbf1ff'); gr.addColorStop(1, '#f3cdf0');
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i < 6; i++) { const x = 50 + i * 36 + r() * 10, rad = 26 + r() * 20 - Math.abs(i - 2.5) * 4; g.moveTo(x + rad, 92 - rad * 0.55); g.arc(x, 92 - rad * 0.55, rad, 0, TAU); }
      g.rect(40, 80, 200, 28); g.fill();
      g.globalCompositeOperation = 'destination-out';  // soft flat base
      const fade = g.createLinearGradient(0, 96, 0, 112); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = fade; g.fillRect(0, 96, 280, 44);
      g.globalCompositeOperation = 'source-over';
      FN.ell(g, 105, 48, 26, 9, 'rgba(255,255,255,.9)', -0.2);
      cloudSprites.push(cv);
    }
  }
  // three cloud layers + far islets, laid out once
  const LAYERS = [
    { f: 0.05, n: 7, s: [0.45, 0.8], y: [0.08, 0.5], v: 4, a: 0.75 },      // far
    { f: 0.16, n: 6, s: [0.8, 1.3], y: [0.2, 0.75], v: 9, a: 0.9 },        // mid
    { f: 0.36, n: 5, s: [1.4, 2.1], y: [0.55, 1.0], v: 16, a: 0.95 },      // near
  ];
  let skyItems = null;
  function layoutSky() {
    const r = FN.rng(4242);
    skyItems = LAYERS.map((L) => Array.from({ length: L.n }, (_, i) => ({ x: (i + r() * 0.7) / L.n, y: FN.lerp(L.y[0], L.y[1], r()), s: FN.lerp(L.s[0], L.s[1], r()), k: (r() * 3) | 0 })));
    skyItems.islets = [{ x: 0.12, y: 0.3, s: 0.55, seed: 3 }, { x: 0.47, y: 0.16, s: 0.4, seed: 4 }, { x: 0.83, y: 0.42, s: 0.7, seed: 6 }];
    skyItems.stars = Array.from({ length: 26 }, () => ({ x: r(), y: r() * 0.6, s: 2 + r() * 4, p: r() * 6 }));
  }
  function drawClouds(c, li, vw, vh, px, py, t) {
    const L = LAYERS[li], loop = vw + 620;
    c.globalAlpha = L.a;
    for (const cl of skyItems[li]) {
      const sp = cloudSprites[cl.k], w = 280 * cl.s, x = mod(cl.x * loop + t * L.v - px * L.f, loop) - 310, y = cl.y * vh - py * L.f * 0.6;
      c.drawImage(sp, x, y - 70 * cl.s, w, 140 * cl.s);
    }
    c.globalAlpha = 1;
  }

  FX.Sky = {
    sun: { x: 0, y: 0, s: 0 },
    draw(c, cfg, cam, vw, vh, scale, t, now, low) {
      if (!cloudSprites.length) { makeCloudSprites(); layoutSky(); }
      const s = FX.sunset(now), px = cam.x * scale, py = cam.y * scale;
      // gradient
      const g = c.createLinearGradient(0, 0, 0, vh);
      cfg.day.forEach((col, i) => g.addColorStop(i / (cfg.day.length - 1), FX.mix(col, cfg.sunset[i], s)));
      c.fillStyle = g; c.fillRect(0, 0, vw, vh);
      // evening stars
      if (s > 0.25) for (const st of skyItems.stars) { c.globalAlpha = (s - 0.25) * 1.3 * (0.5 + 0.5 * Math.sin(t * 2 + st.p)); FX.star(c, st.x * vw, st.y * vh, st.s, '#ffffff', 0); }
      c.globalAlpha = 1;
      // an occasional big rainbow (20s out of every 75s)
      const rb = (now % 75000) / 1000, ra = rb < 20 ? Math.sin(rb / 20 * Math.PI) : 0;
      if (ra > 0.02) {
        c.lineWidth = Math.max(10, vw * 0.012);
        T.holo.concat('#ffc9a8').forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = ra * 0.42; c.beginPath(); c.arc(vw * 0.3 - px * 0.03, vh * 0.95 - py * 0.03, vw * 0.42 - i * c.lineWidth, Math.PI, TAU); c.stroke(); });
        c.globalAlpha = 1;
      }
      // dreamy sun
      const sun = this.sun; sun.x = vw * 0.76 - px * 0.02; sun.y = vh * (0.17 + 0.3 * s) - py * 0.02; sun.s = s;
      if (!low) FN.glow(c, sun.x, sun.y, 330, s > 0.5 ? T.glow.pink : T.glow.gold, 0.5);
      FN.glow(c, sun.x, sun.y, 150, T.glow.white, 0.9);
      FN.ell(c, sun.x, sun.y, 44, 44, FX.mix('#fffdf0', '#ffe1c4', s));
      for (let i = 0; i < 8; i++) { const a = t * 0.1 + i * Math.PI / 4; c.globalAlpha = 0.25; FX.star(c, sun.x + Math.cos(a) * 78, sun.y + Math.sin(a) * 78, 9 + (i % 2) * 6, '#ffffff', a); }
      c.globalAlpha = 1;

      if (!low) drawClouds(c, 0, vw, vh, px, py, t);
      // far floating islands at different heights
      for (const it of skyItems.islets) {
        const loop = vw + 400, x = mod(it.x * loop - px * 0.1, loop) - 200, y = it.y * vh - py * 0.08 + Math.sin(t * 0.5 + it.seed) * 6;
        c.globalAlpha = 0.8; FX.islet(c, x, y, it.s * Math.max(1, vw / 900), it.seed, t, false); c.globalAlpha = 1;
      }
      // winged horses crossing the sky
      for (let i = 0; i < 2; i++) {
        const loop = vw + 500, dir = i ? -1 : 1, x = mod(dir * t * (34 + i * 12) + i * 700 - px * 0.12, loop) - 250, y = vh * (0.22 + i * 0.2) + Math.sin(t * 0.9 + i * 2) * 26 - py * 0.1;
        c.globalAlpha = 0.9; FN.drawPet(c, 'pegasus', x, y, t + i, true, dir, 1.25 + i * 0.3, null, true); c.globalAlpha = 1;
      }
      drawClouds(c, 1, vw, vh, px, py, t);
      // shooting star: one every ~13s
      const k = Math.floor(t / 13), u = (t - k * 13) / 1.1;
      if (u < 1) {
        const x0 = vw * (0.15 + FN.hash(k) * 0.6), y0 = vh * (0.05 + FN.hash(k + 9) * 0.25), x = x0 + u * 260, y = y0 + u * 120;
        const tg = c.createLinearGradient(x - 110, y - 51, x, y); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,255,255,.95)');
        c.strokeStyle = tg; c.lineWidth = 3; c.lineCap = 'round'; c.globalAlpha = Math.sin(u * Math.PI);
        c.beginPath(); c.moveTo(x - 110, y - 51); c.lineTo(x, y); c.stroke(); FX.star(c, x, y, 9, '#fffbe0', t * 4); c.globalAlpha = 1;
      }
      drawClouds(c, 2, vw, vh, px, py, t);
    },
  };

  // ---------- finishing passes (screen space) ----------
  FX.flare = (c, vw, vh) => {                           // lens flare along sun → screen centre
    const sun = FX.Sky.sun; if (sun.x < -200 || sun.x > vw + 200) return;
    c.globalCompositeOperation = 'lighter';
    [[0.38, 34, T.glow.pink], [0.62, 70, T.glow.blue], [1.2, 46, T.glow.mint], [1.65, 110, T.glow.lilac]].forEach(([k, r, col]) =>
      FN.glow(c, sun.x + (vw / 2 - sun.x) * k, sun.y + (vh / 2 - sun.y) * k, r, col, 0.2));
    c.globalCompositeOperation = 'source-over';
  };
})(window.FN);
