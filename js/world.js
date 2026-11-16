/* ============================================================
   world.js — shared helpers, the 5 zone definitions, and all
   scenery drawing. Everything is procedural: no image files.

   To add a zone: add an entry to ZONES + its id to ZONE_ORDER.
   To add scenery: add a draw function to D (and optionally a
   glow to L), then place it in a zone's build() list.
   ============================================================ */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  // ---------- world size (every zone is one W x H map) ----------
  const W = 1600, H = 1100;
  FN.W = W; FN.H = H;

  // ---------- tiny helpers ----------
  FN.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  FN.lerp = (a, b, t) => a + (b - a) * t;
  FN.hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  FN.rng = (seed) => () => {                      // small seeded random (mulberry32)
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  FN.fmt = (ms) => {                              // ms -> "mm:ss"
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  const ell = FN.ell = (c, x, y, rx, ry, fill, rot) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  };
  const rr = FN.rr = (c, x, y, w, h, r, fill) => {  // rounded rectangle
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  };
  const tri = (c, x1, y1, x2, y2, x3, y3, fill) => {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fillStyle = fill; c.fill();
  };

  // Soft glow sprite, cached per colour ("r,g,b"). Much cheaper than shadowBlur.
  const glowCache = {};
  FN.glow = (c, x, y, r, rgb, alpha) => {
    let s = glowCache[rgb];
    if (!s) {
      s = glowCache[rgb] = document.createElement('canvas'); s.width = s.height = 64;
      const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.4, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(s, x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
  };

  // ---------- walkable area ----------
  const ISLE = { cx: 800, cy: 550, rx: 690, ry: 430 };   // island zones use an ellipse
  FN.clampToZone = (zone, x, y) => {
    if (zone.shape === 'ellipse') {
      const dx = (x - ISLE.cx) / ISLE.rx, dy = (y - ISLE.cy) / ISLE.ry, d = Math.hypot(dx, dy);
      if (d > 1) { x = ISLE.cx + dx / d * ISLE.rx; y = ISLE.cy + dy / d * ISLE.ry; }
      return { x, y };
    }
    return { x: FN.clamp(x, 60, W - 60), y: FN.clamp(y, 130, H - 50) };
  };

  // The footpath every zone shares: a gentle curve from left portal to right portal.
  const pathY = (x) => { const t = FN.clamp((x - 130) / 1340, 0, 1); return 550 + 420 * t * (1 - t); };
  const paintPath = (g, color, width) => {
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
    g.beginPath(); g.moveTo(130, 550); g.quadraticCurveTo(800, 760, 1470, 550); g.stroke();
  };

  // ============================================================
  //  SCENERY  (D = draw, L = glow drawn in the additive light pass)
  //  Each item: { type, x, y, s (scale), seed, ... } — (x, y) is its base.
  // ============================================================
  const D = FN.decor = {}, L = FN.lights = {};
  const PASTEL = ['#ff9ebb', '#c9a0ff', '#ffb68a', '#8fd3ff', '#ffd98a'];

  // --- Coral Lagoon ---
  D.coral = (c, d) => {
    const r = FN.rng(d.seed), n = 4 + (d.seed % 3);
    c.strokeStyle = PASTEL[d.seed % 3]; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.4, len = (26 + r() * 24) * d.s;
      const x2 = d.x + Math.cos(a) * len, y2 = d.y + Math.sin(a) * len;
      c.lineWidth = 7 * d.s; c.beginPath(); c.moveTo(d.x, d.y);
      c.quadraticCurveTo(d.x + Math.cos(a) * len * 0.3, d.y - len * 0.7, x2, y2); c.stroke();
      ell(c, x2, y2, 4.5 * d.s, 4.5 * d.s, '#fff6fa');
    }
  };
  L.coral = (c, d, t) => FN.glow(c, d.x, d.y - 28 * d.s, 52 * d.s, '255,160,210', 0.3 + 0.15 * Math.sin(t * 2 + d.seed));
  D.seaweed = (c, d, t) => {
    c.lineCap = 'round'; c.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(t * 1.5 + d.seed + i) * 6, h = (34 + i * 12) * d.s, x = d.x + (i - 1) * 8;
      c.strokeStyle = i % 2 ? '#6fd8b0' : '#43b592';
      c.beginPath(); c.moveTo(x, d.y); c.quadraticCurveTo(x + sway * 2, d.y - h * 0.5, x + sway, d.y - h); c.stroke();
    }
  };
  D.shellHome = (c, d) => {
    c.beginPath(); c.ellipse(d.x, d.y, 58, 64, 0, Math.PI, 0); c.closePath();
    c.fillStyle = ['#ffc9de', '#d9c8ff', '#c4ecff'][d.seed % 3]; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(d.x, d.y - 64); c.quadraticCurveTo(d.x + i * 24, d.y - 40, d.x + i * 27, d.y); c.stroke(); }
    c.beginPath(); c.ellipse(d.x - 8, d.y, 14, 26, 0, Math.PI, 0); c.closePath(); c.fillStyle = '#5d4d85'; c.fill();
    ell(c, d.x + 28, d.y - 22, 8, 8, '#fff2b0');
  };
  L.shellHome = (c, d) => FN.glow(c, d.x + 28, d.y - 22, 34, '255,235,150', 0.7);
  D.pearl = (c, d) => {                               // Pearl Study Grotto centrepiece
    c.beginPath(); c.ellipse(d.x, d.y - 6, 62, 60, 0, Math.PI, 0); c.closePath(); c.fillStyle = '#ffd6e6'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(d.x, d.y - 6); c.lineTo(d.x + i * 17, d.y - 60 + Math.abs(i) * 7); c.stroke(); }
    ell(c, d.x, d.y, 62, 18, '#f3a9c8');
    ell(c, d.x, d.y - 16, 21, 21, '#ffffff'); ell(c, d.x - 7, d.y - 23, 6, 6, 'rgba(205,228,255,.95)');
  };
  L.pearl = (c, d, t) => FN.glow(c, d.x, d.y - 16, 80 + Math.sin(t * 1.6) * 8, '220,240,255', 0.55);

  // --- Skyfield (built entirely on the fx.js style kit) ---
  // Props listed in FN.react bloom / sparkle when the player walks near: main.js eases d.near 0..1.
  FN.react = { flower: 1, crystal: 1, cloud: 1 };
  D.cloud = (c, d, t) => {                            // bouncy jelly cloud
    const s = d.s * (1 + (d.near || 0) * 0.12 * Math.sin(t * 9)), F = FN.FX;
    F.shadow(c, d.x, d.y + 2, 40 * d.s, 8 * d.s);
    const g = c.createLinearGradient(0, d.y - 44 * s, 0, d.y); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1dcff');
    c.fillStyle = g; c.beginPath();
    for (const [px, py, r] of [[-22, -12, 17], [20, -12, 19], [0, -24, 22], [-36, -6, 10], [36, -6, 11]]) { c.moveTo(d.x + (px + r) * s, d.y + py * s); c.arc(d.x + px * s, d.y + py * s, r * s, 0, 6.3); }
    c.fill(); FN.rr(c, d.x - 40 * s, d.y - 14 * s, 80 * s, 14 * s, 7 * s, g);
    F.gloss(c, d.x - 8 * s, d.y - 34 * s, 10 * s, 4 * s, -0.3, 0.9);
  };
  D.flower = (c, d, t) => {                           // three varieties; buds open as you approach
    const F = FN.FX, b = d.near || 0, open = 0.45 + 0.55 * b, s = d.s, kind = d.seed % 3;
    const sway = Math.sin(t * 1.3 + d.seed) * 2.5, h = (26 + (d.seed % 5) * 3) * s + b * 4, hx = d.x + sway, hy = d.y - h;
    const col = FN.THEME.holo[d.seed % 4], col2 = ['#ff8fc8', '#b48cff', '#7fc4ff', '#ffb37a'][d.seed % 4];
    F.shadow(c, d.x, d.y, 9 * s, 3 * s);
    c.strokeStyle = '#5fc98e'; c.lineWidth = 4 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(d.x, d.y); c.quadraticCurveTo(d.x + sway * 0.4, d.y - h * 0.5, hx, hy); c.stroke();
    FN.ell(c, d.x + 5 * s, d.y - h * 0.4, 5 * s, 2.4 * s, '#9be3b8', -0.5);
    const n = kind === 1 ? 3 : kind === 2 ? 5 : 7, pr = (kind === 2 ? 12 : 10) * s * open;
    for (let i = 0; i < n; i++) {
      const a = kind === 1 ? -Math.PI / 2 + (i - 1) * 0.7 * open : i / n * 6.283 + t * 0.2 * b;
      c.beginPath(); c.ellipse(hx + Math.cos(a) * pr * 0.9, hy + Math.sin(a) * pr * 0.9, pr * (kind === 2 ? 0.42 : 0.62), pr * (kind === 1 ? 1.1 : 0.9), a + Math.PI / 2, 0, 6.3);
      c.fillStyle = i % 2 ? col : col2; c.fill(); F.ink(c, 1.1);
    }
    if (kind !== 1) { FN.ell(c, hx, hy, 5 * s * open, 5 * s * open, '#fff3a8'); F.ink(c, 1); }
    if (b > 0.5) F.star(c, hx + 9 * s, hy - 9 * s, 4 * b * s, '#ffffff', t * 2);
  };
  D.crystal = (c, d, t) => {                          // holographic crystal cluster
    const F = FN.FX, s = d.s, b = d.near || 0;
    F.shadow(c, d.x, d.y, 20 * s, 6 * s);
    const shard = (ox, w, h, lean, sh) => {
      const x = d.x + ox * s, top = d.y - h * s;
      c.beginPath(); c.moveTo(x - w * s, d.y); c.lineTo(x - w * 0.7 * s + lean * s, top + 8 * s); c.lineTo(x + lean * s, top); c.lineTo(x + w * 0.7 * s + lean * s, top + 8 * s); c.lineTo(x + w * s, d.y); c.closePath();
      c.fillStyle = F.holo(c, x - w * s, top, x + w * s, d.y, sh + t * (0.05 + b * 0.25)); c.fill(); F.ink(c, 1.3);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x - w * 0.5 * s, d.y - 2); c.lineTo(x - w * 0.3 * s + lean * s, top + 9 * s); c.lineTo(x + lean * s, top + 3 * s); c.lineTo(x - w * 0.05 * s, d.y - 2); c.closePath(); c.fill();
    };
    shard(-11, 6, 22, -3, 0.2); shard(12, 6.5, 27, 4, 0.5); shard(0, 8, 42, 0, d.seed * 0.1);
    F.star(c, d.x + 4 * s, d.y - 44 * s, (4 + Math.sin(t * 3 + d.seed) * 2 + b * 4) * s, '#ffffff', t);
  };
  L.crystal = (c, d, t) => FN.glow(c, d.x, d.y - 22 * d.s, (38 + (d.near || 0) * 30) * d.s, FN.THEME.glow.lilac, 0.22 + 0.1 * Math.sin(t * 2 + d.seed) + (d.near || 0) * 0.3);
  D.starLamp = (c, d, t) => {                         // chrome post with a glowing star
    const F = FN.FX; F.shadow(c, d.x, d.y, 9, 3);
    FN.rr(c, d.x - 2.5, d.y - 62, 5, 62, 2, F.chrome(c, d.y - 62, d.y)); F.ink(c, 1.1);
    FN.ell(c, d.x, d.y - 72, 13, 13, 'rgba(255,214,240,.75)'); F.ink(c, 1.2); F.gloss(c, d.x - 4, d.y - 77, 5, 2.5, -0.5, 0.9);
    F.star(c, d.x, d.y - 72, 10 + Math.sin(t * 3 + d.seed) * 1.5, '#ffd95e', t * 0.5); F.ink(c, 1);
  };
  L.starLamp = (c, d, t) => FN.glow(c, d.x, d.y - 72, 50 + Math.sin(t * 3 + d.seed) * 5, FN.THEME.glow.gold, 0.4);
  D.gazebo = (c, d, t) => {                           // Sky Gazebo: pearl columns, holo dome, chrome star
    const F = FN.FX;
    F.shadow(c, d.x, d.y + 6, 108, 24);
    FN.ell(c, d.x, d.y + 4, 100, 23, '#e6d5ff'); FN.ell(c, d.x, d.y, 100, 23, F.pearl(c, d.x, d.y, 100)); F.ink(c, 1.5);
    for (const px of [-76, -27, 27, 76]) {
      const g = c.createLinearGradient(d.x + px - 6, 0, d.x + px + 6, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fdeeff'); g.addColorStop(1, '#d9c8ff');
      FN.rr(c, d.x + px - 6, d.y - 100, 12, 100, 5, g); F.ink(c, 1.4);
      FN.rr(c, d.x + px - 8, d.y - 100, 16, 6, 3, F.chrome(c, d.y - 100, d.y - 94)); FN.rr(c, d.x + px - 8, d.y - 7, 16, 6, 3, F.chrome(c, d.y - 7, d.y - 1));
    }
    c.beginPath(); c.moveTo(d.x - 106, d.y - 96); c.quadraticCurveTo(d.x - 80, d.y - 190, d.x, d.y - 205); c.quadraticCurveTo(d.x + 80, d.y - 190, d.x + 106, d.y - 96); c.closePath();
    c.fillStyle = F.holo(c, d.x - 110, d.y - 200, d.x + 110, d.y - 96, t * 0.04); c.fill(); F.ink(c, 1.6);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2.5;
    for (const k of [-0.55, 0, 0.55]) { c.beginPath(); c.moveTo(d.x, d.y - 203); c.quadraticCurveTo(d.x + k * 90, d.y - 170, d.x + k * 150, d.y - 98); c.stroke(); }
    F.gloss(c, d.x - 42, d.y - 160, 26, 9, -0.5, 0.6);
    for (let i = -3; i <= 3; i++) { FN.ell(c, d.x + i * 30, d.y - 94, 15, 9, '#ffffff'); }            // scalloped trim
    for (const px of [-52, 0, 52]) { c.strokeStyle = '#c9b5ff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(d.x + px, d.y - 88); c.lineTo(d.x + px, d.y - 70); c.stroke(); F.star(c, d.x + px, d.y - 64 + Math.sin(t * 2 + px) * 2, 6, '#fff3b0', t + px); }
    FN.rr(c, d.x - 2, d.y - 222, 4, 18, 2, F.chrome(c, d.y - 222, d.y - 204)); F.star(c, d.x, d.y - 228, 13, '#fff3b0', t * 0.7); F.ink(c, 1.2);
  };
  L.gazebo = (c, d, t) => { FN.glow(c, d.x, d.y - 228, 46 + Math.sin(t * 2) * 6, FN.THEME.glow.gold, 0.7); for (const px of [-52, 0, 52]) FN.glow(c, d.x + px, d.y - 64, 20, FN.THEME.glow.gold, 0.5); };
  D.islet = (c, d, t) => FN.FX.islet(c, d.x, d.y + (d.gate ? 0 : Math.sin(t * 0.8 + d.seed) * 7), d.s, d.seed, t, d.gate);
  L.islet = (c, d) => { if (d.gate) FN.glow(c, d.x, d.y - 50 * d.s, 70 * d.s, FN.THEME.glow.pink, 0.45); };
  D.bigFlower = (c, d, t) => {
    const sway = Math.sin(t * 1.2 + d.seed) * 3, h = 30 * d.s, col = PASTEL[d.seed % 5];
    c.strokeStyle = '#6fbf7a'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(d.x, d.y); c.quadraticCurveTo(d.x + sway, d.y - h * 0.5, d.x + sway, d.y - h); c.stroke();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ell(c, d.x + sway + Math.cos(a) * 8 * d.s, d.y - h + Math.sin(a) * 8 * d.s, 6 * d.s, 6 * d.s, col); }
    ell(c, d.x + sway, d.y - h, 5 * d.s, 5 * d.s, '#fff3a8');
  };

  // --- Hollyhollow ---
  const snowRoof = (c, x, y, half, peak) => {         // dark roof with a soft snow cap
    tri(c, x - half, y, x, y - peak, x + half, y, '#5a3d58');
    c.strokeStyle = '#f6f9ff'; c.lineWidth = 11; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - half, y - 2); c.lineTo(x, y - peak); c.lineTo(x + half, y - 2); c.stroke();
  };
  D.house = (c, d) => {
    const w = 112, h = 70;
    rr(c, d.x + 20, d.y - h - 58, 15, 34, 2, '#6b4a5c');
    rr(c, d.x - w / 2, d.y - h, w, h, 6, ['#8f5f74', '#75629a', '#94705a'][d.seed % 3]);
    snowRoof(c, d.x, d.y - h + 4, w / 2 + 14, 56);
    rr(c, d.x - 42, d.y - 52, 24, 24, 4, '#ffd98a'); rr(c, d.x + 18, d.y - 52, 24, 24, 4, '#ffd98a');
    c.fillStyle = '#7a5a4a'; c.fillRect(d.x - 31, d.y - 52, 2, 24); c.fillRect(d.x + 29, d.y - 52, 2, 24);
    rr(c, d.x - 10, d.y - 36, 20, 36, 9, '#4a3348');
  };
  L.house = (c, d, t) => {
    const f = 0.75 + 0.08 * Math.sin(t * 3 + d.seed);
    FN.glow(c, d.x - 30, d.y - 40, 46, '255,200,120', f); FN.glow(c, d.x + 30, d.y - 40, 46, '255,200,120', f);
  };
  D.lanternPost = (c, d) => {
    rr(c, d.x - 3, d.y - 70, 6, 70, 2, '#3b3350'); rr(c, d.x - 9, d.y - 90, 18, 22, 5, '#ffe29a');
    tri(c, d.x - 12, d.y - 88, d.x, d.y - 100, d.x + 12, d.y - 88, '#3b3350');
  };
  L.lanternPost = (c, d, t) => FN.glow(c, d.x, d.y - 78, 95 + Math.sin(t * 4 + d.seed) * 4, '255,214,140', 0.5);
  D.pine = (c, d) => {
    const s = d.s; rr(c, d.x - 5 * s, d.y - 14 * s, 10 * s, 14 * s, 2, '#6b4a3a');
    for (let i = 0; i < 3; i++) {
      const y = d.y - 12 * s - i * 22 * s, hw = (34 - i * 8) * s;
      tri(c, d.x - hw, y, d.x, y - 36 * s, d.x + hw, y, i % 2 ? '#3f7d6a' : '#356b5c');
      tri(c, d.x - hw * 0.5, y - 18 * s, d.x, y - 37 * s, d.x + hw * 0.5, y - 18 * s, '#f4f8ff');
    }
  };
  D.library = (c, d, t) => {                          // Fireplace Library centrepiece
    const w = 230, h = 96;
    rr(c, d.x + 60, d.y - h - 78, 20, 44, 2, '#6b4a5c');
    rr(c, d.x - w / 2, d.y - h, w, h, 8, '#84566c');
    snowRoof(c, d.x, d.y - h + 4, w / 2 + 16, 70);
    // bookshelf windows
    for (const sx of [-88, 56]) {
      rr(c, d.x + sx, d.y - 70, 32, 44, 4, '#ffd98a');
      for (let i = 0; i < 6; i++) { c.fillStyle = PASTEL[(i + (sx > 0 ? 2 : 0)) % 5]; c.fillRect(d.x + sx + 3 + i * 4.5, d.y - 64 + (i % 2) * 3, 3.5, 14); c.fillRect(d.x + sx + 3 + i * 4.5, d.y - 44 + ((i + 1) % 2) * 3, 3.5, 14); }
    }
    // the hearth
    c.beginPath(); c.moveTo(d.x - 30, d.y); c.lineTo(d.x - 30, d.y - 38); c.quadraticCurveTo(d.x, d.y - 72, d.x + 30, d.y - 38); c.lineTo(d.x + 30, d.y); c.closePath(); c.fillStyle = '#3a2738'; c.fill();
    const fl = Math.sin(t * 9) * 3;
    ell(c, d.x, d.y - 16, 16, 20 + fl, '#ff9a4a'); ell(c, d.x, d.y - 12, 9, 13 + fl * 0.6, '#ffe08a');
  };
  L.library = (c, d, t) => FN.glow(c, d.x, d.y - 18, 170 + Math.sin(t * 9) * 10, '255,170,90', 0.75);

  // --- Moonlit Pavilion ---
  const PAV = { cx: 560, cy: 380, rx: 175, ry: 92 };  // the dance floor (painted on the ground)
  const pavColumn = (c, a) => rr(c, PAV.cx + Math.cos(a) * PAV.rx * 0.94 - 7, PAV.cy + Math.sin(a) * PAV.ry * 0.94 - 150, 14, 150, 5, '#ece8ff');
  D.pavBack = (c) => {                                // back columns + back half of the roof ring
    for (let k = 0; k < 4; k++) pavColumn(c, Math.PI + (k + 0.5) * Math.PI / 4);
    c.strokeStyle = '#d9d0ff'; c.lineWidth = 14;
    c.beginPath(); c.ellipse(PAV.cx, PAV.cy - 150, PAV.rx, PAV.ry, 0, Math.PI, 0); c.stroke();
  };
  D.pavFront = (c, d, t) => {                         // front columns + ring + hanging lanterns
    for (const a of [0.12, Math.PI - 0.12]) pavColumn(c, a);
    c.strokeStyle = '#e6dfff'; c.lineWidth = 14;
    c.beginPath(); c.ellipse(PAV.cx, PAV.cy - 150, PAV.rx, PAV.ry, 0, 0, Math.PI); c.stroke();
    for (let k = 0; k < 5; k++) {
      const a = (k + 0.5) * Math.PI / 5, x = PAV.cx + Math.cos(a) * PAV.rx, y = PAV.cy - 150 + Math.sin(a) * PAV.ry;
      c.strokeStyle = '#8f86b8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y + 20); c.stroke();
      rr(c, x - 6, y + 20 + Math.sin(t * 2 + k) * 1.5, 12, 15, 4, '#ffd9a0');
    }
  };
  L.pavFront = (c) => {
    for (let k = 0; k < 5; k++) { const a = (k + 0.5) * Math.PI / 5; FN.glow(c, PAV.cx + Math.cos(a) * PAV.rx, PAV.cy - 122 + Math.sin(a) * PAV.ry, 46, '255,210,150', 0.7); }
  };
  D.terrace = (c, d) => {                             // Reading Terrace centrepiece: balustrade + lectern
    c.strokeStyle = '#e4defa'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.ellipse(d.x, d.y + 70 - 22, 116, 72, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    for (let k = 0; k <= 8; k++) { const a = Math.PI * (1.08 + k * 0.105); rr(c, d.x + Math.cos(a) * 116 - 4, d.y + 48 + Math.sin(a) * 72, 8, 24, 3, '#d5cdf2'); }
    rr(c, d.x - 5, d.y - 12, 10, 34, 3, '#b9aee0');
    c.save(); c.translate(d.x, d.y - 16); rr(c, -17, -6, 16, 11, 2, '#fffaf0'); rr(c, 1, -6, 16, 11, 2, '#fff3dd'); c.restore();
  };
  D.floatLantern = (c, d, t) => {
    const y = d.y + Math.sin(t * 1.3 + d.seed) * 3;
    ell(c, d.x, y + 10, 13, 3.5, 'rgba(255,220,160,.35)');
    rr(c, d.x - 8, y - 12, 16, 20, 5, ['#ffd9a0', '#ffc2c2', '#ffe9b0'][d.seed % 3]);
  };
  L.floatLantern = (c, d, t) => FN.glow(c, d.x, d.y - 2, 38 + Math.sin(t * 2 + d.seed) * 4, '255,205,140', 0.75);

  // --- Petalwood ---
  D.flowerHouse = (c, d) => {
    const col = PASTEL[d.seed % 3];
    rr(c, d.x - 34, d.y - 72, 68, 72, 18, '#fff4e2');
    rr(c, d.x - 11, d.y - 34, 22, 34, 11, '#b98a6a'); ell(c, d.x + 19, d.y - 46, 7, 7, '#ffe9a0');
    for (let i = -2; i <= 2; i++) ell(c, d.x + i * 25, d.y - 80 + Math.abs(i) * 9, 21, 36, col, i * 0.38);
    for (let i = -1; i <= 1; i += 2) ell(c, d.x + i * 12, d.y - 86, 15, 30, 'rgba(255,255,255,.28)', i * 0.2);
    ell(c, d.x, d.y - 114, 10, 10, '#ffe08a');
  };
  L.flowerHouse = (c, d) => FN.glow(c, d.x + 19, d.y - 46, 26, '255,233,150', 0.5);
  D.mushroom = (c, d) => {
    const s = d.s; rr(c, d.x - 6 * s, d.y - 16 * s, 12 * s, 16 * s, 4, '#fff6ea');
    c.beginPath(); c.ellipse(d.x, d.y - 14 * s, 19 * s, 15 * s, 0, Math.PI, 0); c.closePath(); c.fillStyle = ['#ff8fa3', '#c9a0ff', '#ffb68a'][d.seed % 3]; c.fill();
    ell(c, d.x - 8 * s, d.y - 20 * s, 3 * s, 3 * s, '#fff'); ell(c, d.x + 6 * s, d.y - 23 * s, 2.5 * s, 2.5 * s, '#fff'); ell(c, d.x + 10 * s, d.y - 17 * s, 2 * s, 2 * s, '#fff');
  };
  D.blossomTree = (c, d) => {
    const s = d.s, col = d.col || ['#ffb7d0', '#ffc9de', '#e3c4ff'][d.seed % 3];
    rr(c, d.x - 7 * s, d.y - 44 * s, 14 * s, 44 * s, 4, d.trunk || '#9a735c');
    ell(c, d.x - 22 * s, d.y - 56 * s, 26 * s, 24 * s, col); ell(c, d.x + 22 * s, d.y - 58 * s, 27 * s, 25 * s, col);
    ell(c, d.x, d.y - 78 * s, 30 * s, 27 * s, col); ell(c, d.x - 8 * s, d.y - 84 * s, 12 * s, 9 * s, 'rgba(255,255,255,.3)');
  };

  // --- shared ---
  D.seat = (c, d) => { ell(c, d.x, d.y, 15, 8, d.col); ell(c, d.x - 3, d.y - 2, 7, 3, 'rgba(255,255,255,.45)'); };

  // ============================================================
  //  ZONES
  //  portals[0] = left (to previous zone), portals[1] = right (to next).
  //  npcs: wander around `home` within `range`. kind 'avatar' | 'pet' | 'crab'.
  // ============================================================
  const circle = (name, x, y, r) => ({ name, x: x == null ? 800 : x, y: y == null ? 430 : y, r: r || 125 });
  const ORDER = FN.ZONE_ORDER = ['lagoon', 'skyfield', 'hollyhollow', 'pavilion', 'petalwood'];

  const Z = FN.ZONES = {
    lagoon: {
      name: 'Coral Lagoon', shape: 'rect', accent: '255,160,210', ui: '#2f7f95',
      particles: 'bubble', seat: '#ffd1e3', circle: circle('Pearl Study Grotto'),
      ground(g, r) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7fd9dd'); gr.addColorStop(1, '#4fa6c6');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) ell(g, r() * W, r() * H, 60 + r() * 90, 26 + r() * 34, 'rgba(255,244,214,.16)');
        paintPath(g, 'rgba(255,240,205,.5)', 78);
        g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 5; g.lineCap = 'round';   // light ripples
        for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, l = 40 + r() * 70; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 14, x + l, y); g.stroke(); }
        for (let i = 0; i < 90; i++) ell(g, r() * W, r() * H, 3 + r() * 4, 2 + r() * 3, 'rgba(255,255,255,.22)');
      },
      build(r, scatter) {
        const out = [[330, 310], [570, 230], [1080, 240], [1310, 330], [300, 880], [1290, 900]].map((p, i) => ({ type: 'shellHome', x: p[0], y: p[1], seed: i }));
        out.push({ type: 'pearl', x: 800, y: 345 });
        return out.concat(scatter('coral', 16, 0.8, 1.3), scatter('seaweed', 18, 0.8, 1.4));
      },
      npcs: [
        { name: 'Marisol the Pearl-Keeper', kind: 'avatar', a: { kind: 'mermaid', scheme: 2, skin: 1 }, home: [620, 620], range: 170 },
        { name: 'Ondine', kind: 'avatar', a: { kind: 'mermaid', scheme: 1, skin: 3 }, home: [1100, 520], range: 200 },
        { name: 'Old Barnaby', kind: 'crab', home: [900, 850], range: 220 },
      ],
    },

    // ---- Skyfield: the reference zone for the Y2K style system (see fx.js) ----
    skyfield: {
      name: 'Skyfield', shape: 'ellipse', accent: '255,200,240', ui: '#8a74e8',
      particles: 'glitter', seat: '#ffffff', circle: Object.assign(circle('Sky Gazebo'), { lift: 250 }),
      pad: 260,                                           // extra painted margin around the map (bridges, islets, underside)
      sky: { day: ['#7fc8ff', '#bfe3ff', '#ffdff4'], sunset: ['#8b7df0', '#ff9fd2', '#ffd7a6'] },
      ambient: { butterflies: 8, hearts: true },
      blocks: [{ x: 1120, y: 820, r: 95 }],               // keep scenery off the wishing pool
      ground(g, r) {
        const F = FN.FX, cx = 800, cy = 556;
        // rainbow bridges out to the star-gate islets
        for (const dir of [-1, 1]) {
          const X = (v) => (dir < 0 ? v : 1600 - v);
          F.shadow(g, X(-20), 640, 150, 16);
          g.lineCap = 'butt'; g.lineWidth = 8;
          ['#ff9fd6', '#ffc7a0', '#fff3b0', '#b8ffe9', '#b5d8ff', '#d9b8ff'].forEach((col, i) => {
            g.strokeStyle = col; g.beginPath(); g.moveTo(X(170), 532 + i * 7.5); g.quadraticCurveTo(X(-10), 440 + i * 7.5, X(-150), 580 + i * 7.5); g.stroke();
          });
          g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(170), 530); g.quadraticCurveTo(X(-10), 438, X(-150), 578); g.stroke();
        }
        // underside: a lilac-to-pink crystal keel hanging below the island
        let gr = g.createLinearGradient(0, cy, 0, 1180); gr.addColorStop(0, '#ecdcff'); gr.addColorStop(0.55, '#c3adff'); gr.addColorStop(1, '#ffbfe6');
        g.fillStyle = gr; g.beginPath(); g.moveTo(76, cy); g.bezierCurveTo(190, 1010, 600, 1165, 800, 1172); g.bezierCurveTo(1000, 1165, 1410, 1010, 1524, cy); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.2)';
        for (let i = 0; i < 9; i++) { const x = 240 + i * 140 + r() * 40, w = 30 + r() * 30; g.beginPath(); g.moveTo(x - w, 880); g.lineTo(x, 1020 + r() * 120 - Math.abs(x - 800) * 0.22); g.lineTo(x + w * 0.4, 880); g.closePath(); g.fill(); }
        for (let i = 0; i < 7; i++) { const x = 420 + i * 125 + r() * 30, y = 1090 - Math.abs(x - 800) * 0.28; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y + 46 + r() * 30); g.lineTo(x + 12, y); g.closePath(); g.fillStyle = FN.THEME.holo[i % 4]; g.fill(); }
        // puffy cloud rim (lilac underside first, white on top)
        const puffs = []; for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2; puffs.push([cx + Math.cos(a) * 716, cy + 4 + Math.sin(a) * 456, 56 + r() * 28, 44 + r() * 20]); }
        for (const p of puffs) ell(g, p[0], p[1] + 16, p[2], p[3], '#e2cfff');
        for (const p of puffs) ell(g, p[0], p[1], p[2], p[3], '#ffffff');
        ell(g, cx, cy, 722, 462, '#ffffff');
        // meadow with a soft iridescent sheen
        gr = g.createRadialGradient(cx - 120, cy - 140, 60, cx, cy, 700); gr.addColorStop(0, '#d9fbdc'); gr.addColorStop(0.6, '#aaf0c6'); gr.addColorStop(1, '#8fe3d2');
        ell(g, cx, 548, 668, 412, gr);
        g.save(); g.beginPath(); g.ellipse(cx, 548, 668, 412, 0, 0, 6.3); g.clip();
        for (let i = 0; i < 16; i++) { g.globalAlpha = 0.13; ell(g, 200 + r() * 1200, 200 + r() * 700, 90 + r() * 120, 36 + r() * 50, FN.THEME.holo[i % 5]); }
        g.globalAlpha = 1; g.restore();
        // pearl path with a star trail
        paintPath(g, 'rgba(255,255,255,.95)', 84); paintPath(g, '#ffeefb', 72); paintPath(g, 'rgba(217,184,255,.25)', 52);
        for (let x = 190, i = 0; x < 1420; x += 58, i++) F.star(g, x, pathY(x), i % 2 ? 6 : 4, FN.THEME.holo[i % 5], 0);
        // heart-shaped wishing pool
        F.heart(g, 1120, 816, 66, '#ffffff'); gr = g.createLinearGradient(0, 760, 0, 870); gr.addColorStop(0, '#c9ecff'); gr.addColorStop(1, '#93c9ff');
        F.heart(g, 1120, 816, 56, gr); F.gloss(g, 1092, 792, 18, 7, -0.5, 0.75); F.star(g, 1146, 806, 7, '#ffffff', 0);
        // sprinkles
        for (let i = 0; i < 150; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.93, x = cx + Math.cos(a) * 668 * d, y = 548 + Math.sin(a) * 412 * d; if (i % 4) ell(g, x, y, 2.4, 2.4, PASTEL[i % 5]); else F.star(g, x, y, 4.5, '#ffffff', 0); }
      },
      // animated ground-level extras, drawn every frame under the characters
      groundFx(c, t) {
        for (const [x, y] of [[520, 988], [1130, 972]]) {           // cloud waterfalls off the front rim
          const g = c.createLinearGradient(0, y, 0, y + 240); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.fillRect(x - 26, y, 52, 240);
          for (let i = 0; i < 7; i++) { const k = ((t * 0.55 + i / 7) % 1); ell(c, x - 18 + (i * 13) % 37, y + k * 220, 5, 16, `rgba(255,255,255,${0.75 * (1 - k)})`); }
          for (let i = 0; i < 3; i++) ell(c, x - 22 + i * 22, y + 2 + Math.sin(t * 2 + i) * 2, 20, 13, '#ffffff');
        }
        FN.FX.star(c, 1146, 806, 6 + Math.sin(t * 3) * 3, 'rgba(255,255,255,.9)', t);            // pool twinkle
        ell(c, 1104 + Math.sin(t * 0.8) * 10, 822, 16, 3, 'rgba(255,255,255,.4)');
      },
      build(r, scatter) {
        const out = [{ type: 'gazebo', x: 800, y: 372 },
          { type: 'islet', x: -185, y: 612, s: 1.5, gate: true, seed: 2, yd: -500 }, { type: 'islet', x: 1785, y: 612, s: 1.5, gate: true, seed: 5, yd: -500 },
          { type: 'islet', x: 40, y: 110, s: 1.1, seed: 3, yd: -500 }, { type: 'islet', x: 1570, y: 70, s: 1.35, seed: 4, yd: -500 },
          { type: 'islet', x: 1660, y: 1060, s: 1.0, seed: 6, yd: -500 }, { type: 'islet', x: -70, y: 1040, s: 0.9, seed: 7, yd: -500 }];
        for (const x of [330, 560, 1040, 1270]) out.push({ type: 'starLamp', x, y: pathY(x) - 54, seed: x });
        scatter('crystal', 9, 0.8, 1.25); scatter('cloud', 6, 0.75, 1.1); scatter('flower', 30, 0.9, 1.35);
        return out;
      },
      npcs: [
        { name: 'Nimbus', kind: 'pet', pet: 'pegasus', scale: 2.1, home: [480, 520], range: 190 },
        { name: 'Featherwhistle', kind: 'pet', pet: 'pegasus', scale: 1.9, color: '#ffeaf6', home: [1130, 640], range: 190 },
        { name: 'Odette the Cloud Shepherd', kind: 'avatar', a: { kind: 'princess', scheme: 3, skin: 2 }, home: [1050, 380], range: 150 },
      ],
    },

    hollyhollow: {
      name: 'Hollyhollow', shape: 'rect', accent: '255,200,120', ui: '#4b4a7d', night: 'rgba(22,26,70,.34)',
      particles: 'snow', seat: '#d9737f', circle: circle('Fireplace Library'),
      ground(g, r) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#cfd9f3'); gr.addColorStop(1, '#b3c0e4');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 34; i++) ell(g, r() * W, r() * H, 70 + r() * 110, 26 + r() * 36, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(150,165,215,.18)');
        paintPath(g, 'rgba(126,136,180,.55)', 74);
        for (let i = 0; i < 70; i++) { const x = 140 + r() * 1320; ell(g, x, pathY(x) + (r() - 0.5) * 50, 9, 5, 'rgba(255,255,255,.2)'); }   // cobbles
      },
      build(r, scatter) {
        const out = [[300, 300], [545, 240], [1075, 245], [1330, 310], [270, 890], [530, 960], [1090, 960], [1350, 880]].map((p, i) => ({ type: 'house', x: p[0], y: p[1], seed: i }));
        for (const x of [300, 560, 1040, 1300]) out.push({ type: 'lanternPost', x, y: pathY(x) - 58, seed: x });
        out.push({ type: 'library', x: 800, y: 330 });
        return out.concat(scatter('pine', 22, 0.9, 1.5));
      },
      npcs: [
        { name: 'Grandmother Juniper', kind: 'avatar', a: { kind: 'princess', scheme: 0, skin: 0 }, home: [560, 560], range: 150 },
        { name: 'Tobias the Lamplighter', kind: 'avatar', a: { kind: 'prince', scheme: 5, skin: 2 }, home: [1060, 640], range: 220 },
        { name: 'Snowdrop', kind: 'pet', pet: 'fox', scale: 1.5, home: [820, 860], range: 240 },
      ],
    },

    pavilion: {
      name: 'Moonlit Pavilion', shape: 'ellipse', accent: '200,205,255', ui: '#3d4a86', night: 'rgba(18,24,72,.3)',
      particles: 'firefly', seat: '#cbbcf6', circle: circle('Reading Terrace', 1090, 470, 115),
      ground(g, r) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2c3a78'); gr.addColorStop(1, '#4a5fa3');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        ell(g, 1330, 90, 54, 54, '#fdf8e2'); ell(g, 1330, 90, 150, 150, 'rgba(255,250,220,.1)');     // moon on the water
        g.strokeStyle = 'rgba(255,250,225,.3)'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 70; i++) { const y = r() * H, x = 1330 + (r() - 0.5) * (80 + y * 0.3), l = 18 + r() * 50; g.beginPath(); g.moveTo(x - l / 2, y); g.lineTo(x + l / 2, y); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.1)';
        for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, l = 20 + r() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
        ell(g, 800, 562, 735, 470, '#e8dcc0'); ell(g, 800, 552, 712, 450, '#7fb59a'); ell(g, 800, 546, 690, 430, '#8cc2a4');
        for (let i = 0; i < 26; i++) ell(g, 250 + r() * 1100, 250 + r() * 600, 50 + r() * 80, 20 + r() * 30, 'rgba(255,255,255,.08)');
        paintPath(g, 'rgba(236,228,255,.55)', 66);
        ell(g, PAV.cx, PAV.cy + 8, PAV.rx + 14, PAV.ry + 12, '#b9aee0'); ell(g, PAV.cx, PAV.cy, PAV.rx + 8, PAV.ry + 6, '#efeaff');   // dance floor
        g.strokeStyle = '#d5cbf5'; g.lineWidth = 3;
        for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(PAV.cx, PAV.cy, PAV.rx * k / 3.3, PAV.ry * k / 3.3, 0, 0, 6.3); g.stroke(); }
        ell(g, 1090, 470, 132, 132 * 0.62 + 40, 'rgba(240,235,255,.5)');                         // terrace paving
      },
      build(r, scatter) {
        const out = [{ type: 'pavBack', x: PAV.cx, y: PAV.cy - PAV.ry }, { type: 'pavFront', x: PAV.cx, y: PAV.cy + PAV.ry + 4 }, { type: 'terrace', x: 1090, y: 400 }];
        for (let i = 0; out.length < 21 && i < 400; i++) {    // lanterns drifting on the lake
          const x = r() * W, y = r() * H, e = Math.hypot((x - 800) / 735, (y - 562) / 470);
          if (e > 1.06) out.push({ type: 'floatLantern', x, y, seed: i });
        }
        for (const x of [330, 1300]) out.push({ type: 'lanternPost', x, y: pathY(x) - 54, seed: x });
        return out.concat(scatter('blossomTree', 9, 0.8, 1.1, { col: '#b6a8e8', trunk: '#6d5c84' }), scatter('bigFlower', 10, 0.8, 1.1));
      },
      npcs: [
        { name: 'Madame Celestine', kind: 'avatar', a: { kind: 'princess', scheme: 1, skin: 1 }, home: [PAV.cx - 40, PAV.cy], range: 70 },
        { name: 'Sir Alder', kind: 'avatar', a: { kind: 'prince', scheme: 3, skin: 3 }, home: [PAV.cx + 40, PAV.cy + 10], range: 70 },
        { name: 'Moonpuff', kind: 'pet', pet: 'bunny', scale: 1.5, home: [820, 780], range: 200 },
      ],
    },

    petalwood: {
      name: 'Petalwood', shape: 'rect', accent: '255,240,150', ui: '#5f9a6a',
      particles: 'petal', seat: 'mushroom', circle: circle('Blossom Study Circle'),
      ground(g, r) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#c9eebf'); gr.addColorStop(1, '#a3d9a5');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 34; i++) ell(g, r() * W, r() * H, 60 + r() * 100, 24 + r() * 36, i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(90,170,110,.14)');
        paintPath(g, 'rgba(255,238,205,.7)', 72);
        for (let i = 0; i < 240; i++) { const x = r() * W, y = r() * H; ell(g, x, y, 3.2, 3.2, PASTEL[i % 5]); ell(g, x, y, 1.2, 1.2, '#fff8c8'); }
      },
      build(r, scatter) {
        const out = [[320, 310], [1285, 300], [330, 900], [1270, 910], [565, 235], [1050, 230]].map((p, i) => ({ type: 'flowerHouse', x: p[0], y: p[1], seed: i }));
        return out.concat(scatter('blossomTree', 14, 0.9, 1.3), scatter('mushroom', 12, 0.9, 1.5), scatter('bigFlower', 20, 0.9, 1.5));
      },
      npcs: [
        { name: 'Thistle', kind: 'avatar', a: { kind: 'fairy', scheme: 2, skin: 2 }, home: [560, 540], range: 180 },
        { name: 'Fennel', kind: 'avatar', a: { kind: 'fairy', scheme: 4, skin: 0 }, home: [1090, 620], range: 180 },
        { name: 'Bramble', kind: 'pet', pet: 'hedgehog', scale: 1.4, home: [780, 870], range: 240 },
      ],
    },
  };

  // Fill in the parts every zone shares: id, portals, spawn point.
  ORDER.forEach((id, i) => {
    const z = Z[id]; z.id = id; z.seed = 101 + i * 37;
    z.prev = ORDER[(i + ORDER.length - 1) % ORDER.length]; z.next = ORDER[(i + 1) % ORDER.length];
    z.portals = [{ x: 130, y: 550, to: z.prev }, { x: 1470, y: 550, to: z.next }];
    z.spawn = { x: 610, y: 700 };
  });

  // Build a zone's scenery list (deterministic, so every visitor sees the same layout).
  FN.buildDecor = (zone) => {
    const r = FN.rng(zone.seed), c = zone.circle, list = [];
    const free = (x, y) => {
      const p = FN.clampToZone(zone, x, y);
      if (Math.hypot(p.x - x, p.y - y) > 1) return false;
      if (zone.shape === 'ellipse' && Math.hypot((x - 800) / 640, (y - 550) / 390) > 1) return false;
      if (Math.hypot(x - c.x, y - c.y) < c.r + 70) return false;
      if (Math.abs(y - pathY(x)) < 62) return false;
      if ((zone.blocks || []).some((b) => Math.hypot(x - b.x, y - b.y) < b.r)) return false;
      if (zone.id === 'pavilion' && Math.hypot((x - PAV.cx) / (PAV.rx + 50), (y - PAV.cy) / (PAV.ry + 60)) < 1) return false;
      return !list.some((d) => Math.hypot(d.x - x, d.y - y) < 74);
    };
    const scatter = (type, n, s0, s1, extra) => {
      const out = [];
      for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
        const x = 70 + r() * (W - 140), y = 150 + r() * (H - 210);
        if (!free(x, y)) continue;
        const d = Object.assign({ type, x, y, s: FN.lerp(s0, s1, r()), seed: Math.floor(r() * 1e4) }, extra);
        out.push(d); list.push(d); i++;
      }
      return out;
    };
    // Pass 1 collects the hand-placed pieces, pass 2 scatters the rest around them.
    zone.build(FN.rng(zone.seed + 1), () => []).forEach((d) => { if (d.s == null) d.s = 1; if (d.seed == null) d.seed = 0; list.push(d); });
    zone.build(FN.rng(zone.seed + 1), scatter);
    // seats around the Study Circle
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.08 + i * 0.168), x = c.x + Math.cos(a) * c.r * 0.74, y = c.y + Math.sin(a) * c.r * 0.74 * 0.62;
      list.push(zone.seat === 'mushroom' ? { type: 'mushroom', x, y, s: 0.9, seed: i } : { type: 'seat', x, y, col: zone.seat, s: 1, seed: i });
    }
    return list;
  };

  // Paint the static ground once into an offscreen canvas (cheap to blit each frame).
  FN.paintGround = (zone, canvas) => {
    const pad = zone.pad || 0, g = canvas.getContext('2d');
    canvas.width = W + pad * 2; canvas.height = H + pad * 2;          // zones with `pad` paint beyond the map edge
    g.translate(pad, pad);
    zone.ground(g, FN.rng(zone.seed + 5));
  };

  // ---------- portals & the Study Circle ring (animated, drawn on the ground) ----------
  FN.drawPortal = (c, p, zone, t) => {
    const rgb = FN.ZONES[p.to].accent;
    ell(c, p.x, p.y, 46, 22, `rgba(${rgb},.35)`);
    c.strokeStyle = `rgba(${rgb},.95)`; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = t * 1.6 + i * 2.1; c.beginPath(); c.ellipse(p.x, p.y, 40 - i * 9, 18 - i * 4, 0, a, a + 1.9); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(p.x, p.y, 46, 22, 0, 0, 6.3); c.stroke();
  };
  // progress: 0..1 arc shown while a session runs (null when idle)
  FN.drawCircle = (c, zone, t, progress, onBreak) => {
    const k = zone.circle, sq = 0.62, rgb = zone.accent;      // sq = vertical squash for the 2.5D look
    ell(c, k.x, k.y, k.r, k.r * sq, `rgba(${rgb},.2)`);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.setLineDash([10, 12]); c.lineDashOffset = -t * 14;
    c.beginPath(); c.ellipse(k.x, k.y, k.r, k.r * sq, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 8; i++) { const a = t * 0.4 + i * Math.PI / 4; FN.FX.star(c, k.x + Math.cos(a) * k.r, k.y + Math.sin(a) * k.r * sq, 5 + (i % 2) * 3, i % 2 ? '#ffffff' : FN.THEME.holo[i % 5], a); }
    if (progress != null) {
      c.strokeStyle = onBreak ? 'rgba(160,230,200,.95)' : `rgba(${rgb},1)`; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.ellipse(k.x, k.y, k.r - 9, (k.r - 9) * sq, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * FN.clamp(progress, 0.001, 1)); c.stroke();
    }
  };
  FN.inCircle = (zone, x, y) => { const k = zone.circle; return Math.hypot(x - k.x, (y - k.y) / 0.62) < k.r; };

  // ---------- ambient particles (screen space, so they are free to cull) ----------
  FN.makeParticles = (zone, vw, vh, low) => {
    const n = Math.round(FN.clamp(vw * vh / 16000, 22, 70) * (low ? 0.5 : 1)), out = [];
    for (let i = 0; i < n; i++) out.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.5 + Math.random(), p: Math.random() * 6.28 });
    return out;
  };
  FN.drawParticles = (c, zone, list, vw, vh, t, dt) => {
    const type = zone.particles;
    for (const p of list) {
      if (type === 'bubble') {
        p.y -= (18 + p.s * 26) * dt; p.x += Math.sin(t * 1.5 + p.p) * 0.3;
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, 2 + p.s * 4, 0, 6.3); c.stroke();
      } else if (type === 'snow') {
        p.y += (22 + p.s * 30) * dt; p.x += Math.sin(t + p.p) * 0.4;
        ell(c, p.x, p.y, 1.4 + p.s * 1.6, 1.4 + p.s * 1.6, 'rgba(255,255,255,.85)');
      } else if (type === 'petal') {
        p.y += (16 + p.s * 20) * dt; p.x += (10 + Math.sin(t + p.p) * 14) * dt;
        if (p.s > 1.2) FN.glow(c, p.x, p.y, 9, '255,245,160', 0.5 + 0.5 * Math.sin(t * 3 + p.p));   // fireflies
        else ell(c, p.x, p.y, 4, 2.4, 'rgba(255,183,208,.8)', t + p.p);
      } else if (type === 'firefly') {
        p.x += Math.cos(t * 0.6 + p.p) * 14 * dt; p.y += Math.sin(t * 0.8 + p.p * 2) * 12 * dt - 3 * dt;
        FN.glow(c, p.x, p.y, 6 + p.s * 5, '255,236,170', 0.35 + 0.45 * Math.abs(Math.sin(t * 1.4 + p.p)));
      } else if (type === 'glitter') {                           // twinkling ✦ glints + soft glitter dust
        p.x += (6 + p.s * 8) * dt; p.y -= (4 + p.s * 6) * dt + Math.sin(t * 0.7 + p.p) * 4 * dt;
        const tw = Math.max(0, Math.sin(t * (1.5 + p.s) + p.p));
        if (p.s > 0.95) FN.FX.star(c, p.x, p.y, (2 + p.s * 4) * tw, `rgba(255,255,255,${0.9 * tw})`, t * 0.5 + p.p);
        else ell(c, p.x, p.y, 1 + p.s * 1.4, 1 + p.s * 1.4, FN.THEME.holo[(p.p * 10 | 0) % 5]);
      } else {                                                   // 'feather' — slow sky sparkles
        p.x += (8 + p.s * 10) * dt; p.y += Math.sin(t * 0.7 + p.p) * 6 * dt;
        ell(c, p.x, p.y, 1.5 + p.s, 1.5 + p.s, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + p.p)})`);
      }
      if (p.y < -12) p.y = vh + 10; else if (p.y > vh + 12) p.y = -10;
      if (p.x < -12) p.x = vw + 10; else if (p.x > vw + 12) p.x = -10;
    }
  };
})(window.FN);
