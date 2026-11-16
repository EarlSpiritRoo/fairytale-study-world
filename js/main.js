/* ============================================================
   main.js — glue: title + character select, input, game loop,
   rendering, networking and the study UI.

   Sections:  1 setup · 2 screens · 3 zones · 4 input
              5 update · 6 network · 7 render · 8 study UI

   Render order each frame (the style system's "pipeline"):
     sky backdrop → painted ground → ground effects → depth-sorted
     props/characters → critters + particles → night tint →
     additive glow (bloom) → sunset tint → lens flare → glitter →
     name tags and plaques   (the vignette is a CSS layer: #vignette)
   ============================================================ */
(function (FN) {
  'use strict';
  const { W, H, ZONES, Study, Net, FX, Audio } = FN;
  const $ = (id) => document.getElementById(id);
  const EMOTES = ['👋', '✨', '💪', '☕'];
  const SPEED = 215;                    // walking speed, world units / second
  const SEND_MS = 100;                  // position broadcast interval (~10 per second)
  const CAM_EASE = 5;                   // higher = snappier camera
  const START_ZONE = 'skyfield';

  // ============================================================ 1. SETUP
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const ground = document.createElement('canvas');     // pre-painted static ground of the current zone
  const cam = { x: 0, y: 0, snap: true };
  const skyCv = document.createElement('canvas'), skyCtx = skyCv.getContext('2d'); let skyAge = 99;
  let vw = 0, vh = 0, dpr = 1, scale = 1, hudBottom = 0;
  let zone = null, decor = [], reactive = [], particles = [];
  let joined = false, onTitle = true;
  let lowQ = false, autoQ = true, slowFrames = 0, costMs = 0, gapMs = 16;       // adaptive quality: see frame()

  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const pick = (n) => Math.floor(Math.random() * n);
  const rid = (n) => Math.random().toString(36).slice(2, 2 + n);

  // ============================================================ 2. TITLE + CHARACTER SELECT
  const randomLook = () => ({ kind: FN.KINDS[pick(4)], scheme: pick(FN.SCHEMES.length), skin: pick(FN.SKINS.length), pet: FN.PETS[pick(4)] });
  const stored = load('fablenook.me') || {};
  const me = Object.assign({ uid: 'u' + rid(10), name: FN.randomName() }, randomLook(), stored);
  me.zone = START_ZONE;                 // everyone arrives in Skyfield
  me.key = me.uid + '-' + rid(4);       // one presence key per TAB, so two tabs show up as two visitors
  Object.assign(me, { x: ZONES[me.zone].spawn.x, y: ZONES[me.zone].spawn.y, dir: 1, moving: false, target: null, bubble: null, trail: 0 });
  me.fol = { x: me.x - 30, y: me.y, dir: 1, moving: false };      // pet follower
  Study.me = me.uid;
  const others = {};                    // presence key -> remote player

  const saveProfile = () => save('fablenook.me', { uid: me.uid, name: me.name, kind: me.kind, scheme: me.scheme, skin: me.skin, pet: me.pet });

  function buildPicker(el, items, get, set, render) {
    el.innerHTML = '';
    items.forEach((item, i) => {
      const b = document.createElement('button'); b.type = 'button';
      render(b, item, i);
      b.onclick = () => { set(item, i); [...el.children].forEach((c, j) => c.classList.toggle('on', j === i)); Audio.sfx('pop'); };
      b.classList.toggle('on', get(item, i));
      el.appendChild(b);
    });
  }
  function buildJoin() {
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    buildPicker($('pickKind'), FN.KINDS, (k) => k === me.kind, (k) => { me.kind = k; }, (b, k) => { b.className = 'chip'; b.textContent = cap(k); });
    buildPicker($('pickScheme'), FN.SCHEMES, (s, i) => i === me.scheme, (s, i) => { me.scheme = i; },
      (b, s) => { b.className = 'swatch'; b.title = s.name; b.style.background = `linear-gradient(135deg, ${s.main} 55%, ${s.hair} 55%)`; });
    buildPicker($('pickSkin'), FN.SKINS, (s, i) => i === me.skin, (s, i) => { me.skin = i; }, (b, s) => { b.className = 'swatch'; b.style.background = s; b.title = 'Skin tone'; });
    buildPicker($('pickPet'), FN.PETS, (p) => p === me.pet, (p) => { me.pet = p; }, (b, p) => { b.className = 'chip'; b.textContent = FN.PET_LABEL[p]; });
    $('nameInput').value = me.name;
  }
  $('rollName').onclick = () => { $('nameInput').value = FN.randomName(); };
  $('rollAll').onclick = () => { Object.assign(me, randomLook()); me.name = FN.randomName(); buildJoin(); };

  // title screen → character select → world
  $('start').onclick = () => {
    Audio.unlock(); Audio.sfx('start');
    if (Audio.wantsMusic()) setMusic(true);
    $('title').hidden = true; $('join').hidden = false; onTitle = false;
  };
  $('enter').onclick = () => {
    me.name = $('nameInput').value.trim().slice(0, 28) || FN.randomName();
    saveProfile(); Audio.unlock(); Audio.sfx('portal');
    joined = true; $('join').hidden = true; $('hud').hidden = false;
    FX.burst(me.x, me.y - 30, 16);
    Net.connect(me.key); pushPresence(); uiTick();
  };
  function setMusic(on) { Audio.setMusic(on); $('musicBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); }
  $('musicBtn').onclick = () => { Audio.unlock(); setMusic(!Audio.musicOn); };
  // every button gets a soft click
  document.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('#pickKind,#pickScheme,#pickSkin,#pickPet,#start,#enter')) Audio.sfx('click'); });

  // ============================================================ 3. ZONES
  function enterZone(id) {
    zone = ZONES[id]; me.zone = id;
    FN.paintGround(zone, ground);
    decor = FN.buildDecor(zone);
    decor.forEach((d) => { d.sy = d.y + (d.yd || 0); d.near = 0; });   // sy = depth-sort key, near = proximity 0..1
    reactive = decor.filter((d) => FN.react[d.type]);
    particles = FN.makeParticles(zone, vw, vh);
    FX.clearParticles(); FX.makeCritters(zone);
    cam.snap = true;
    $('zoneName').textContent = zone.name;
    document.documentElement.style.setProperty('--zone', zone.ui);
  }
  function travel(portalIndex) {
    const goingNext = portalIndex === 1, to = zone.portals[portalIndex].to;
    $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 260);
    Audio.sfx('portal');
    enterZone(to);
    const arrive = zone.portals[goingNext ? 0 : 1];                // come out of the opposite portal
    me.x = arrive.x + (goingNext ? 100 : -100); me.y = arrive.y; me.dir = goingNext ? 1 : -1;
    me.target = null; me.fol.x = me.x; me.fol.y = me.y;
    FX.burst(me.x, me.y - 30, 14);
    pushPresence(); sendPosition(true);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, lowQ ? 1 : 2);    // capped for performance (1 in low-quality mode)
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    scale = Math.max(FN.clamp(Math.min(vw, vh) / 640, 0.62, 1.2), vw / W, vh / H);
    if (zone) particles = FN.makeParticles(zone, vw, vh, lowQ);
    cam.snap = true;
  }
  window.addEventListener('resize', resize);

  // ============================================================ 4. INPUT
  const keys = {};
  const KEYMAP = { w: 'u', a: 'l', s: 'd', d: 'r', arrowup: 'u', arrowleft: 'l', arrowdown: 'd', arrowright: 'r' };
  const typing = (e) => /INPUT|TEXTAREA/.test(e.target.tagName);
  window.addEventListener('keydown', (e) => {
    if (typing(e) || !joined) return;
    const k = KEYMAP[e.key.toLowerCase()];
    if (k) { keys[k] = true; me.target = null; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // tap / click (and drag) to move
  let pointerDown = false;
  const aim = (e) => { me.target = FN.clampToZone(zone, cam.x + e.clientX / scale, cam.y + e.clientY / scale); };
  canvas.addEventListener('pointerdown', (e) => {
    if (!joined) return;
    pointerDown = true; $('chatInput').blur(); aim(e);
    FX.emit('spark', me.target.x, me.target.y, { n: 4, spread: 40, size: 5 });          // tap feedback
  });
  canvas.addEventListener('pointermove', (e) => { if (pointerDown) aim(e); });
  window.addEventListener('pointerup', () => { pointerDown = false; });

  // ============================================================ 5. UPDATE
  function follow(owner, f, dt) {                                  // pet eases toward a spot just behind its owner
    const tx = owner.x - owner.dir * 30 - f.x, ty = owner.y + 5 - f.y, d = Math.hypot(tx, ty);
    if (d > 420) { f.x = owner.x; f.y = owner.y; return; }
    f.moving = d > 7;
    if (f.moving) { const step = Math.min(d - 5, Math.min(d * 4.5, 290) * dt); f.x += tx / d * step; f.y += ty / d * step; if (Math.abs(tx) > 2) f.dir = tx > 0 ? 1 : -1; }
    else f.dir = owner.dir;
  }
  function sparkleTrail(p, dt) {                                   // little ✦ trail behind anyone who is walking
    if (!p.moving) return;
    p.trail = (p.trail || 0) + dt;
    if (p.trail > 0.085) { p.trail = 0; FX.emit(Math.random() < 0.75 ? 'spark' : 'dot', p.x - p.dir * 8 + (Math.random() - 0.5) * 12, p.y - 4 - Math.random() * 16, { size: 4.5, life: 0.7, up: 4 }); }
  }

  function update(dt) {
    if (joined) {
      let dx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), dy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), step = SPEED * dt;
      if (dx || dy) { const d = Math.hypot(dx, dy); dx /= d; dy /= d; }
      else if (me.target) {
        const tx = me.target.x - me.x, ty = me.target.y - me.y, d = Math.hypot(tx, ty);
        if (d < 3) me.target = null; else { dx = tx / d; dy = ty / d; step = Math.min(step, d); }
      }
      me.moving = !!(dx || dy);
      if (me.moving) {
        const p = FN.clampToZone(zone, me.x + dx * step, me.y + dy * step);
        me.x = p.x; me.y = p.y;
        if (Math.abs(dx) > 0.15) me.dir = dx > 0 ? 1 : -1;
      }
      // portals
      for (let i = 0; i < zone.portals.length; i++) {
        const p = zone.portals[i];
        if (Math.hypot(me.x - p.x, (me.y - p.y) * 1.7) < 34) { travel(i); break; }
      }
      // Study Circle membership (a solo session keeps you out of the shared timer)
      const mine = FN.inCircle(zone, me.x, me.y) && !Study.solo ? zone.id : null;
      if (mine !== Study.myCircle) { Study.myCircle = mine; pushPresence(); uiTick(); }

      // reactive scenery: bloom / sparkle when the player comes close
      const ease = Math.min(1, dt * 7);
      for (const d of reactive) {
        const dist = Math.hypot(d.x - me.x, d.y - me.y), on = dist < 76;
        d.near += ((on ? 1 : 0) - d.near) * ease;
        if (on && !d.hot) { d.hot = true; FX.burst(d.x, d.y - 26 * d.s, d.type === 'crystal' ? 12 : 6); Audio.sfx('sparkle'); }
        else if (!on && dist > 120) d.hot = false;
      }
    }
    follow(me, me.fol, dt);
    sparkleTrail(me, dt);

    // smooth other players toward their latest reported position
    const k = 1 - Math.exp(-dt * 12);
    for (const id in others) {
      const o = others[id], ddx = o.tx - o.x, ddy = o.ty - o.y;
      o.moving = Math.hypot(ddx, ddy) > 3;
      if (Math.abs(ddx) > 1.5) o.dir = ddx > 0 ? 1 : -1;
      o.x += ddx * k; o.y += ddy * k;
      follow(o, o.fol, dt);
      if (o.zone === zone.id) sparkleTrail(o, dt);
    }

    // camera: ease toward the player, centred in the space the bottom HUD leaves free
    const viewW = vw / scale, viewH = vh / scale, m = zone.pad || 0;
    const bias = joined ? Math.min(hudBottom, vh * 0.45) / 2 / scale : 0;
    // on the title screen the camera drifts along the island's top edge to show off the sky
    const fx = onTitle ? 800 + Math.sin(performance.now() / 9000) * 260 : me.x, fy = onTitle ? 40 : me.y - 30;
    const tx = FN.clamp(fx - viewW / 2, -m, Math.max(-m, W - viewW + m));
    const ty = FN.clamp(fy - viewH / 2 + bias, -m, Math.max(-m, H - viewH + m));
    const ce = cam.snap ? 1 : 1 - Math.exp(-dt * (onTitle ? 1.2 : CAM_EASE));
    cam.x += (tx - cam.x) * ce; cam.y += (ty - cam.y) * ce; cam.snap = false;
  }

  // ============================================================ 6. NETWORK
  const num = (v, a, b, d) => (isFinite(v) ? FN.clamp(+v, a, b) : d);
  function myMeta() {
    return {
      n: me.name, k: me.kind, sc: me.scheme, sk: me.skin, p: me.pet, z: me.zone,
      x: Math.round(me.x), y: Math.round(me.y), tm: Study.total(),
      so: Study.solo ? { sub: Study.solo.subject, e: Study.solo.endsAt } : null,   // solo session
      ci: Study.myCircle,                                                          // circle I'm standing in
      cs: Study.circles,                                                           // sessions I know about (for late joiners)
    };
  }
  function pushPresence() { if (joined) Net.track(myMeta()); }

  let lastSent = { x: 0, y: 0, at: 0 };
  function sendPosition(force) {
    const now = performance.now(), moved = Math.abs(me.x - lastSent.x) + Math.abs(me.y - lastSent.y) > 0.5;
    if (!joined || (!force && now - lastSent.at < (moved ? SEND_MS : 3000))) return;   // idle = slow heartbeat
    lastSent = { x: me.x, y: me.y, at: now };
    Net.send('p', { i: me.key, z: me.zone, x: Math.round(me.x), y: Math.round(me.y) });
  }

  // Never trust data from the network: clamp and whitelist everything.
  function cleanMeta(m) {
    return {
      name: String(m.n || 'Wanderer').slice(0, 28),
      kind: FN.KINDS.includes(m.k) ? m.k : 'fairy',
      scheme: num(m.sc, 0, FN.SCHEMES.length - 1, 0) | 0, skin: num(m.sk, 0, FN.SKINS.length - 1, 0) | 0,
      pet: FN.PETS.includes(m.p) ? m.p : 'kitten',
      zone: ZONES[m.z] ? m.z : START_ZONE,
      mx: num(m.x, 0, W, 800), my: num(m.y, 0, H, 660),
      tm: num(m.tm, 0, 9999999, 0) | 0,
      so: m.so && isFinite(m.so.e) ? { sub: String(m.so.sub || '').slice(0, 24), e: +m.so.e } : null,
      ci: ZONES[m.ci] ? m.ci : null,
    };
  }
  Net.on('presence', (state) => {
    let newcomer = false;
    for (const key in state) {
      if (key === me.key) continue;
      const raw = state[key] || {}, m = cleanMeta(raw);
      let o = others[key];
      if (!o || o.zone !== m.zone) {                               // new player, or they changed zone: snap
        newcomer = newcomer || !o;
        o = others[key] = Object.assign(o || { dir: 1, bubble: null }, { x: m.mx, y: m.my, tx: m.mx, ty: m.my, fol: { x: m.mx - 30, y: m.my, dir: 1 } });
      }
      Object.assign(o, m);
      if (raw.cs && typeof raw.cs === 'object') for (const z in raw.cs) Study.mergeCircle(z, raw.cs[z]);
    }
    for (const key in others) if (!(key in state)) delete others[key];
    if (newcomer) { Study.shareLedgerSoon(); sendPosition(true); }
    uiTick();
  });
  Net.on('msg:p', (p) => {
    const o = others[p.i]; if (!o || !ZONES[p.z]) return;
    const x = num(p.x, 0, W, o.tx), y = num(p.y, 0, H, o.ty);
    if (o.zone !== p.z) { o.zone = p.z; o.x = x; o.y = y; o.fol.x = x; o.fol.y = y; }
    o.tx = x; o.ty = y;
  });
  const say = (who, text) => { who.bubble = { text, until: performance.now() + 4500 }; };
  Net.on('msg:c', (p) => { const o = others[p.i]; if (o && typeof p.m === 'string') say(o, p.m.slice(0, 80)); });
  Net.on('msg:e', (p) => { const o = others[p.i]; if (o && EMOTES[p.e]) { say(o, EMOTES[p.e]); if (o.zone === zone.id) FX.emit('heart', o.x, o.y - 60, { n: 3, spread: 30, up: 30, size: 6, col: '#ff9fd6' }); } });
  Net.on('msg:cs', (p) => { Study.mergeCircle(p.z, p.st); uiTick(); });
  Net.on('msg:lc', (p) => Study.mergeLedger(p));
  Net.on('msg:lg', (p) => Study.mergeLedger(p));
  Net.on('status', (s) => {
    $('netStatus').textContent = {
      online: '', reconnecting: 'Reconnecting…',
      unconfigured: 'Solo mode — paste your Supabase keys into config.js to see friends',
      error: 'Solo mode — could not reach Supabase',
    }[s] || '';
    if (s === 'online') { pushPresence(); sendPosition(true); }
  });

  // ============================================================ 7. RENDER
  const sx = (x) => (x - cam.x) * scale, sy = (y) => (y - cam.y) * scale;
  const LABEL = FN.THEME.fontLabel;

  // text pill centred on x with its bottom edge at y; returns the y above it. jelly = glossy tinted style
  function pill(text, x, y, font, bg, fg, jelly) {
    ctx.font = font;
    const w = ctx.measureText(text).width + 18, h = parseInt(font.match(/(\d+)px/)[1], 10) + 10;
    if (jelly) FX.jelly(ctx, x - w / 2, y - h, w, h, h / 2, jelly[0], jelly[1]); else FN.rr(ctx, x - w / 2, y - h, w, h, h / 2, bg);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2 + 0.5);
    return y - h - 3;
  }

  // what a player's study bubble should say right now (or null)
  function studyText(solo, circleId, now) {
    if (solo && solo.e > now) return '📖 Studying · ' + (solo.sub ? solo.sub + ' · ' : '') + FN.fmt(solo.e - now);
    if (circleId) {
      const ph = Study.phase(circleId, now);
      if (ph.name === 'focus') return '📖 Circle focus · ' + FN.fmt(ph.left);
      if (ph.name === 'break') return '☕ Break · ' + FN.fmt(ph.left);
    }
    return null;
  }
  function drawTags(p, name, minutes, study, perfNow) {
    const x = sx(p.x);
    let y = sy(p.y) - 76 * scale;
    y = pill(name + (minutes ? '  ✦ ' + minutes + 'm' : ''), x, y, '600 12px ' + LABEL, 'rgba(255,255,255,.9)', '#5b4590');
    if (study) y = pill(study, x, y, '600 12.5px ' + LABEL, null, '#8a3f8f', ['rgba(255,214,240,.96)', 'rgba(222,200,255,.94)']);   // glossy timer bubble
    if (p.bubble && p.bubble.until > perfNow) pill(p.bubble.text, x, y, p.bubble.text.length <= 2 ? '22px sans-serif' : '600 13px ' + LABEL, null, '#5b4590', ['#ffffff', '#f3eaff']);
  }
  const circleCount = (zoneId) => { let n = Study.myCircle === zoneId ? 1 : 0; for (const k in others) if (others[k].ci === zoneId) n++; return n; };

  // the Study Circle's glossy plaque: floats above the centrepiece (circle.lift) or sits below the ring
  function drawPlaque(t, now, ph) {
    const k = zone.circle, w = 252, h = 64, x = sx(k.x);
    let y = k.lift ? sy(k.y - k.r * 0.62 - k.lift) + Math.sin(t * 1.4) * 4 : sy(k.y + k.r * 0.62 + 6);
    if (!k.lift) y = Math.min(y, vh - hudBottom - h - 12);        // ground plaques stay clear of the bottom buttons
    if (y < -h || y > vh) return;
    FX.jelly(ctx, x - w / 2, y, w, h, 20, 'rgba(255,255,255,.93)', 'rgba(238,224,255,.9)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = zone.ui; ctx.font = '400 18px ' + FN.THEME.fontDisplay; ctx.fillText(k.name, x, y + 17);
    ctx.fillStyle = '#5b4590'; ctx.font = '600 12.5px ' + LABEL;
    ctx.fillText('✨ ' + Study.zoneTotal(zone.id) + ' minutes focused here today', x, y + 36);
    ctx.fillStyle = '#9383c4';
    ctx.fillText(circleCount(zone.id) + ' studying here now' + (ph.name === 'focus' ? '  ·  ⏳ ' + FN.fmt(ph.left) : ph.name === 'break' ? '  ·  ☕ ' + FN.fmt(ph.left) : ''), x, y + 52);
    FX.star(ctx, x - w / 2 + 4, y + 6, 8 + Math.sin(t * 3) * 2, '#fff3b0', t); FX.star(ctx, x + w / 2 - 6, y + h - 6, 6 + Math.cos(t * 3) * 2, '#ffb3e6', -t);
  }

  function render(t, dt) {
    const now = Date.now(), perfNow = performance.now();
    const viewW = vw / scale, viewH = vh / scale, pad = zone.pad || 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (zone.sky) {                                                                // parallax backdrop
      // The sky is soft and slow, so it is painted at half resolution on every 2nd frame (4th in
      // low quality) into its own canvas and simply blitted here. Big saving, invisible difference.
      if (skyCv.width !== Math.ceil(vw / 2) || skyCv.height !== Math.ceil(vh / 2)) { skyCv.width = Math.ceil(vw / 2); skyCv.height = Math.ceil(vh / 2); skyAge = 99; }
      if (++skyAge >= (lowQ ? 4 : 2)) { skyAge = 0; skyCtx.setTransform(0.5, 0, 0, 0.5, 0, 0); FX.Sky.draw(skyCtx, zone.sky, cam, vw, vh, scale, t, now, lowQ); }
      ctx.drawImage(skyCv, 0, 0, vw, vh);
    }
    ctx.save(); ctx.scale(scale, scale); ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(ground, -pad, -pad);

    // --- ground level: zone effects, Study Circle ring, portals ---
    if (zone.groundFx) zone.groundFx(ctx, t);
    const k = zone.circle, ph = Study.phase(zone.id, now);
    FN.drawCircle(ctx, zone, t, ph.name === 'idle' ? null : 1 - ph.progress, ph.name === 'break');
    zone.portals.forEach((p) => {
      FN.drawPortal(ctx, p, zone, t);
      if (joined) pill('→ ' + ZONES[p.to].name, p.x, p.y - 34, '600 14px ' + LABEL, null, ZONES[p.to].ui, ['rgba(255,255,255,.92)', 'rgba(240,228,255,.88)']);
    });

    // --- everything that stands up, sorted back-to-front by y ---
    const x0 = cam.x - 260, x1 = cam.x + viewW + 260, y0 = cam.y - 80, y1 = cam.y + viewH + 280;
    const items = [], vis = [];
    for (const d of decor) if (d.x > x0 && d.x < x1 && d.y > y0 && d.y < y1) { items.push({ y: d.sy, d }); vis.push(d); }
    const npcStates = zone.npcs.map((n, i) => FN.npcState(zone, n, i, now));
    zone.npcs.forEach((n, i) => items.push({ y: npcStates[i].y, npc: n, st: npcStates[i] }));
    const players = [me];
    for (const id in others) if (others[id].zone === zone.id) players.push(others[id]);
    for (const p of players) { items.push({ y: p.y, p }); items.push({ y: p.fol.y, pet: p }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.d) FN.decor[it.d.type](ctx, it.d, t);
      else if (it.npc) FN.drawNpc(ctx, it.npc, it.st, t);
      else if (it.p) FN.drawAvatar(ctx, it.p, it.p.x, it.p.y, t, it.p.moving, it.p.dir);
      else FN.drawPet(ctx, it.pet.pet, it.pet.fol.x, it.pet.fol.y, t, it.pet.fol.moving, it.pet.fol.dir);
    }
    FX.ambient(zone, cam, viewW, viewH, dt);
    FX.drawCritters(ctx, dt, t);
    FX.drawParticles(ctx, dt);

    // --- night tint, then bloom: glowing things added on top ---
    if (zone.night) { ctx.fillStyle = zone.night; ctx.fillRect(cam.x - 1, cam.y - 1, viewW + 2, viewH + 2); }
    ctx.globalCompositeOperation = 'lighter';
    if (!lowQ) for (const d of vis) if (FN.lights[d.type]) FN.lights[d.type](ctx, d, t);
    for (const p of zone.portals) FN.glow(ctx, p.x, p.y, 60, ZONES[p.to].accent, 0.35);
    if (ph.name === 'focus') FN.glow(ctx, k.x, k.y, k.r * 1.1, zone.accent, 0.16 + 0.06 * Math.sin(t * 2));
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // --- screen-space finishing: sunset tint, lens flare, glitter ---
    if (zone.sky) {
      const s = FX.sunset(now);
      if (s > 0.02 && !lowQ) { ctx.fillStyle = `rgba(255,140,190,${0.13 * s})`; ctx.fillRect(0, 0, vw, vh); }
      if (!lowQ) FX.flare(ctx, vw, vh);
    }
    FN.drawParticles(ctx, zone, particles, vw, vh, t, dt);

    // --- labels (crisp at any zoom) ---
    if (!joined) return;
    if (!FN.inCircle(zone, me.x, me.y)) drawPlaque(t, now, ph);                    // the DOM panel replaces it inside the circle
    zone.npcs.forEach((n, i) => pill(n.name, sx(npcStates[i].x), sy(npcStates[i].y) - (FN.npcHeight(n) + 4) * scale, '500 12px ' + LABEL, 'rgba(255,255,255,.62)', '#7a6aa8'));
    for (const p of players) {
      if (p === me) drawTags(me, me.name, Study.total(), studyText(Study.solo && { sub: Study.solo.subject, e: Study.solo.endsAt }, Study.myCircle, now), perfNow);
      else drawTags(p, p.name, p.tm, studyText(p.so, p.ci, now), perfNow);
    }
  }

  // live avatar preview on the character select screen
  const pv = $('preview'), pctx = pv.getContext('2d');
  function renderPreview(t) {
    pctx.setTransform(2, 0, 0, 2, 0, 0); pctx.clearRect(0, 0, 200, 200);
    for (let i = 0; i < 6; i++) FX.star(pctx, 30 + i * 30, 40 + Math.sin(t + i * 2) * 14 + (i % 2) * 30, 4 + 3 * Math.sin(t * 2 + i), FN.THEME.holo[i % 5], t + i);
    FN.drawAvatar(pctx, me, 86, 168, t, false, 1, 2.3);
    FN.drawPet(pctx, me.pet, 158, 174, t, false, -1, 1.9);
  }

  let last = performance.now();
  function frame(nowMs) {
    requestAnimationFrame(frame);                                   // one rAF loop drives everything; it pauses itself in hidden tabs
    const last0 = last, dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
    const t = nowMs / 1000;
    const t0 = performance.now();
    update(dt);
    sendPosition(false);
    render(t, dt);
    // Adaptive quality: if frames stay expensive for ~2 seconds, drop the costly polish (bloom, flare,
    // vignette, retina resolution, half the glitter) once, and keep the game smooth on weak devices.
    costMs += (performance.now() - t0 - costMs) * 0.05;
    gapMs += (Math.min(100, nowMs - last0) - gapMs) * 0.05;
    if (autoQ && !lowQ && (costMs > 12 || gapMs > 25)) { if (++slowFrames > 90) { lowQ = true; resize(); document.body.classList.add('lowq'); } } else slowFrames = 0;
    if (!joined && !$('join').hidden) renderPreview(t);
  }

  // ============================================================ 8. STUDY UI
  let toastTimer = null;
  function toast(title, sub) {
    const el = $('toast'); el.textContent = title;
    if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
    el.hidden = true; void el.offsetWidth; el.hidden = false;       // restart the pop animation
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  Study.send = (type, payload) => Net.send(type, payload);
  Study.onChange = () => pushPresence();
  Study.onEvent = (evt) => {
    const mins = (window.FABLE_CONFIG || {}).BREAK_MINUTES || 5;
    if (evt === 'soloDone') { Audio.sfx('chime'); FX.burst(me.x, me.y - 40, 20); toast('Break time!', 'Session complete. Stretch, sip, breathe.'); }
    if (evt === 'break') { Audio.sfx('chime'); FX.burst(me.x, me.y - 40, 20); toast('Break time!', mins + ' minutes together, then the next round.'); }
    if (evt === 'breakOver') { Audio.sfx('pop'); toast('Break is over', 'Start the next round when the circle is ready.'); }
    if (evt === 'circleStart') Audio.sfx('start');
    uiTick();
  };

  // --- solo dialog ---
  let soloMin = 25, circleMin = 25;
  function chipGroup(selector, attr, input, set) {
    const chips = [...document.querySelectorAll(selector)];
    chips.forEach((c) => { c.onclick = () => { chips.forEach((o) => o.classList.toggle('on', o === c)); input.value = ''; set(+c.getAttribute(attr)); }; });
    input.oninput = () => { const v = parseInt(input.value, 10); if (v > 0) { chips.forEach((o) => o.classList.remove('on')); set(v); } };
  }
  chipGroup('[data-min]', 'data-min', $('soloCustom'), (v) => { soloMin = v; });
  chipGroup('[data-cmin]', 'data-cmin', $('circleCustom'), (v) => { circleMin = v; });
  $('studyBtn').onclick = () => { $('studyModal').hidden = false; };
  $('soloCancel').onclick = () => { $('studyModal').hidden = true; };
  $('soloGo').onclick = () => { Audio.unlock(); Audio.sfx('start'); Study.startSolo(soloMin, $('soloSubject').value.trim()); $('studyModal').hidden = true; uiTick(); };
  $('soloStop').onclick = () => { Study.stopSolo(); uiTick(); };
  $('circleStart').onclick = () => { Audio.unlock(); if (Study.myCircle) Study.startCircle(Study.myCircle, circleMin); uiTick(); };

  // --- chat & emotes (focus mode = emotes only) ---
  $('chatForm').onsubmit = (e) => {
    e.preventDefault();
    const text = $('chatInput').value.trim().slice(0, 80);
    if (!text || Study.inFocus()) return;
    say(me, text); Net.send('c', { i: me.key, m: text }); $('chatInput').value = '';
  };
  document.querySelectorAll('[data-emote]').forEach((b) => {
    b.onclick = () => { const i = +b.dataset.emote; say(me, EMOTES[i]); Net.send('e', { i: me.key, e: i }); FX.emit('heart', me.x, me.y - 60, { n: 3, spread: 30, up: 30, size: 6, col: '#ff9fd6' }); };
  });

  // --- refresh all the DOM bits; runs 4x a second and after any change ---
  function uiTick() {
    if (!joined) return;
    const now = Date.now();
    $('myMinutes').textContent = Study.total();
    let inZone = 1, all = 1; for (const k in others) { all++; if (others[k].zone === zone.id) inZone++; }
    $('onlineCount').textContent = Net.isOnline() ? inZone + ' here · ' + all + ' online' : '';

    const solo = Study.solo, standing = FN.inCircle(zone, me.x, me.y);
    // inside a circle the panel takes over, so the solo button steps aside (less clutter, nothing to overlap)
    $('studyBtn').hidden = !!solo || standing; $('soloPill').hidden = !solo;
    $('studyRow').hidden = $('studyBtn').hidden && $('soloPill').hidden;
    if (solo) $('soloText').textContent = '📖 ' + (solo.subject ? solo.subject + ' · ' : '') + FN.fmt(solo.endsAt - now);

    const focus = Study.inFocus();
    $('chatForm').hidden = focus; $('focusNote').hidden = !focus;

    $('circlePanel').hidden = !standing;
    if (standing) {
      const ph = Study.phase(zone.id, now), blocked = !!solo;
      $('circleTitle').textContent = zone.circle.name;
      $('circleStat').textContent = '✨ ' + Study.zoneTotal(zone.id) + ' minutes focused here today · ' + circleCount(zone.id) + ' here now';
      $('circleBlocked').hidden = !blocked;
      $('circleIdle').hidden = blocked || ph.name !== 'idle';
      $('circleRunning').hidden = blocked || ph.name === 'idle';
      if (ph.name !== 'idle') {
        $('circleClock').textContent = (ph.name === 'focus' ? '' : '☕ ') + FN.fmt(ph.left);
        $('circleHint').textContent = ph.name === 'focus'
          ? 'Focus round of ' + ph.st.len + ' min. You earn minutes while you stay in the circle.'
          : 'Break together. The next round can start when it ends.';
      }
    }
    hudBottom = $('bottom').offsetHeight + 10;                      // the camera and the plaque keep clear of this
  }
  setInterval(() => { Study.tick(); uiTick(); }, 250);              // setInterval keeps the timers alive in background tabs

  // ============================================================ GO
  resize();
  enterZone(me.zone);
  buildJoin();
  requestAnimationFrame(frame);

  FN._debug = { me, others, enterZone, cam, perf: () => ({ ms: +costMs.toFixed(2), gap: +gapMs.toFixed(1), lowQ }), setLow: (v) => { lowQ = v; autoQ = false; resize(); document.body.classList.toggle('lowq', v); } };                       // handy in the browser console
})(window.FN);
