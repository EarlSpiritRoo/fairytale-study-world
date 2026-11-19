/* ============================================================
   audio.js: every sound is synthesised with Web Audio, so there
   are no audio files to host. Optional CC0 files can replace any
   ambience sound later: list them in config.js (AUDIO_FILES).

   FN.Audio.unlock()              call from a click (browsers require it)
   FN.Audio.sfx(name)             'click' 'pop' 'sparkle' 'portal' 'start' 'chime'
   FN.Audio.setZone(id, sources)  switch realm: fades the old soundscape out, the new one in
                                  sources = [{ kind, pos: {x,y,z}, r, gain }] positional sounds
   FN.Audio.listen(pos, fwd)      every frame: where the listener is and which way they face
   FN.Audio.setAmbience(bool)     ambience on / off (on by default, remembered)
   FN.Audio.setPad(bool)          very soft ambient pad, no melody (off by default, remembered)
   FN.Audio.setVolume(bus, 0..1)  'ambience' | 'effects' sliders (remembered)
   FN.Audio.setMuted(bool)        master mute for everything (remembered)

   Mixer:   effects ─┐
            ambience ─ zone (crossfade) ─ beds + positional sources ─┤
                       pad ──────────────────────────────────────────┤
                                                       master (mute) ─ speakers

   Realm beds:        skyfield: wind          lagoon: underwater hum      hollyhollow: wind and snow
                      pavilion: crickets + breeze                          petalwood: birdsong + rustling leaves
   Nothing drones: wind, leaves, lake laps, the lagoon hum and the fire roar all "come and go" on
   randomised rhythms (breathe() and GUSTS below). Crickets, birds, bubbles, chimes and wings were
   already occasional. Waterfalls stay steady, as real ones do.
   Positional kinds:  waterfall, wings, bubbles, fire, shore, chimes  (zone.sounds in each realm file)
   ============================================================ */
(function (FN) {
  'use strict';
  const cfg = window.FABLE_CONFIG || {};
  let ac = null, master, fxBus, ambBus, padBus, noiseBuf = null;
  const lastPlayed = {}, files = {}, timers = [];
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const A = FN.Audio = {
    muted: read('fablenook.muted', '0') === '1',
    ambienceOn: read('fablenook.ambience', '1') === '1',
    padOn: read('fablenook.pad', '0') === '1',
    vol: { ambience: +read('fablenook.volAmb', '0.7'), effects: +read('fablenook.volFx', '0.8') },
  };
  let zone = null, want = null;                        // the live soundscape, and the one asked for before unlock

  A.unlock = () => {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(ac.destination);
        fxBus = ac.createGain(); fxBus.gain.value = A.vol.effects; fxBus.connect(master);
        ambBus = ac.createGain(); ambBus.gain.value = A.ambienceOn ? A.vol.ambience : 0; ambBus.connect(master);
        padBus = ac.createGain(); padBus.gain.value = 0; padBus.connect(master);
        // 4 s of white noise, shared by every synthesised texture
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        loadFiles();
        if (want) { const w = want; want = null; A.setZone(w.id, w.sources); }
        if (A.padOn) startPad();
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  };

  // ---------- small building blocks ----------
  const now = () => ac.currentTime;
  function tone(dest, type, f0, f1, t0, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(rate = 1) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random() * 3; s.start(now(), Math.random() * 3); return s; }
  function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function lfo(param, rate, depth) { const o = ac.createOscillator(), g = gain(depth); o.frequency.value = rate; o.connect(g); g.connect(param); o.start(); return o; }
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  // run fn every `every` seconds (± jitter), on a look-ahead clock that keeps going in background tabs
  function every(ctx, base, jitter, fn) { let next = now() + Math.random() * base; const id = setInterval(() => { while (next < now() + 1.5) { if (!ctx.dead) fn(next); next += base + (Math.random() - 0.5) * 2 * jitter; } }, 400); timers.push(id); ctx.timers.push(id); }

  // "come and go": drives one or more gain nodes with the same randomised envelope, so a texture swells in,
  // stays a while, fades out and rests before the next one. Every range is [min, max] seconds, picked fresh each time.
  //   pulses  how many swells in a set (1 = a single gust; 2-4 = a run of lake laps)
  //   rise / hold / fall   one swell;   dip  level between swells in a set;   rest  the quiet after a set
  //   floor   level during the rest (0 = silent; above 0 = it only ebbs, for things that never really stop)
  function breathe(ctx, o) {
    const gs = [], rnd = (r) => r[0] + Math.random() * (r[1] - r[0]), floor = o.floor || 0;
    let t = null;
    const at = (fn) => { for (const g of gs) fn(g.gain); };
    const tick = () => {
      if (ctx.dead || !gs.length) return;
      if (t === null) { t = now() + 0.1 + Math.random() * (o.delay || 0); at((p) => p.setValueAtTime(floor, now())); }
      while (t < now() + 4) {
        const n = Math.max(1, Math.round(rnd(o.pulses || [1, 1])));
        for (let i = 0; i < n; i++) {
          const peak = 0.75 + Math.random() * 0.25, up = rnd(o.rise), hold = rnd(o.hold), down = rnd(o.fall), low = i < n - 1 ? (o.dip == null ? floor : o.dip) : floor;
          at((p) => { p.cancelScheduledValues(t); p.setValueAtTime(i ? (o.dip == null ? floor : o.dip) : floor, t); p.linearRampToValueAtTime(peak, t + up); p.setValueAtTime(peak, t + up + hold); p.linearRampToValueAtTime(low, t + up + hold + down); });
          t += up + hold + down;
        }
        t += rnd(o.rest);
      }
    };
    const id = setInterval(tick, 500); timers.push(id); ctx.timers.push(id); setTimeout(tick, 0);
    const b = { kind: o, gs, add() { const g = gain(floor); gs.push(g); return g; } }; ctx.breaths = (ctx.breaths || []).concat(b); return b;
  }
  // the rhythms (seconds)
  const GUSTS = {
    rustle:  { rise: [2, 3.5], hold: [5, 11], fall: [2.5, 4], rest: [3, 9], delay: 2 },                    // Petalwood leaves: gust, then just birds
    breeze:  { rise: [2.5, 4], hold: [4, 8], fall: [3, 5], rest: [4, 10], delay: 3 },                       // Pavilion breeze
    skywind: { rise: [2, 3], hold: [6, 12], fall: [3, 4.5], rest: [3, 7], floor: 0.15 },                   // Skyfield: a little air stays
    snow:    { rise: [2, 3.5], hold: [5, 10], fall: [3, 4.5], rest: [3, 8], floor: 0.2 },                   // Hollyhollow wind
    whistle: { rise: [1.5, 2.5], hold: [2, 5], fall: [2, 3], rest: [6, 14], delay: 6 },                     // Hollyhollow's thin whistle
    laps:    { pulses: [2, 4], rise: [0.8, 1.3], hold: [0.1, 0.4], fall: [1.6, 2.4], dip: 0.12, rest: [2, 5] },   // lake laps, then a hush
    hum:     { rise: [3, 5], hold: [6, 12], fall: [3, 5], rest: [3, 6], floor: 0.35 },                      // lagoon: the hum ebbs, never stops
    roar:    { rise: [1.5, 3], hold: [3, 7], fall: [1.5, 3], rest: [2, 5], floor: 0.5 },                    // fire: swells and settles
  };

  // ---------- optional CC0 files: FABLE_CONFIG.AUDIO_FILES = { waterfall: 'audio/waterfall.mp3', … } ----------
  function loadFiles() {
    const list = cfg.AUDIO_FILES || {};
    for (const k in list) fetch(list[k]).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => ac.decodeAudioData(b)).then((buf) => { files[k] = buf; if (zone && zone.uses[k]) A.setZone(zone.id, zone.sources, true); }).catch(() => {});
  }
  const fileLoop = (k, vol) => { const s = ac.createBufferSource(); s.buffer = files[k]; s.loop = true; s.start(now(), Math.random() * Math.max(0, files[k].duration - 1)); return chain(s, gain(vol)); };

  // ---------- realm beds (non-positional) ----------
  function wind(ctx, level = 1, cut = 520, gust = null) {   // brown-ish noise; with a gust rhythm it comes and goes
    const lp = filt('lowpass', cut, 0.4), g = gain(0.22 * level);
    lfo(lp.frequency, 0.07, cut * 0.45); lfo(g.gain, 0.11, 0.09 * level);
    chain(noise(0.5), filt('lowpass', 900), lp, g, gust ? breathe(ctx, gust).add() : gain(1), ctx.out);
  }
  const BEDS = {
    skyfield(ctx) { wind(ctx, 0.9, 480, GUSTS.skywind); every(ctx, 9, 4, (t) => wingBeat(ctx.out, t, 0.05)); },           // high wind, now and then distant wings
    lagoon(ctx) {                                     // muffled underwater hum
      const g = gain(0.09); lfo(g.gain, 0.08, 0.03);
      for (const f of [55, 82.4, 110.3]) { const o = ac.createOscillator(); o.frequency.value = f; o.type = 'sine'; o.start(); chain(o, g); }
      const ebb = breathe(ctx, GUSTS.hum);
      chain(g, filt('lowpass', 240), ebb.add(), ctx.out);
      chain(noise(0.35), filt('lowpass', 260, 0.5), gain(0.35), ebb.add(), ctx.out);
      every(ctx, 1.4, 1.1, (t) => bubble(ctx.out, t, 0.035));
    },
    hollyhollow(ctx) {                                // wind and snow: low wind plus a thin whistle
      wind(ctx, 0.7, 420, GUSTS.snow);
      const w = filt('bandpass', 1500, 6), g = gain(0.03); lfo(w.frequency, 0.05, 500); lfo(g.gain, 0.09, 0.025);
      chain(noise(1), w, g, breathe(ctx, GUSTS.whistle).add(), ctx.out);
    },
    pavilion(ctx) {                                   // crickets and a soft breeze over the lake (the breeze comes and goes; the crickets are untouched)
      wind(ctx, 0.45, 380, GUSTS.breeze);
      for (let c = 0; c < 3; c++) { const f = 4100 + c * 380, pan = ac.createStereoPanner ? ac.createStereoPanner() : null; const out = pan ? (pan.pan.value = (c - 1) * 0.6, pan.connect(ctx.out), pan) : ctx.out;
        every(ctx, 0.9 + c * 0.25, 0.2, (t) => { for (let k = 0; k < 3; k++) tone(out, 'sine', f, f, t + k * 0.045, 0.03, 0.012); }); }
    },
    petalwood(ctx) {                                  // birdsong, and leaves that rustle in gusts with quiet (just birds) between
      const hp = filt('highpass', 1800, 0.5), g = gain(0.05); lfo(g.gain, 0.13, 0.04);
      chain(noise(1), hp, filt('lowpass', 5200), g, breathe(ctx, GUSTS.rustle).add(), ctx.out);
      every(ctx, 3.2, 2, (t) => bird(ctx.out, t));
    },
  };
  function wingBeat(dest, t, vol) {                   // two soft whooshes
    for (let k = 0; k < 2; k++) { const s = noise(0.8), bp = filt('bandpass', 420, 1.2), g = gain(0.0001); chain(s, bp, g, dest);
      g.gain.setValueAtTime(0.0001, t + k * 0.32); g.gain.exponentialRampToValueAtTime(vol, t + k * 0.32 + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.32 + 0.3); s.stop(t + k * 0.32 + 0.35); }
  }
  function bubble(dest, t, vol) { const f = 280 + Math.random() * 380; tone(dest, 'sine', f, f * (2 + Math.random()), t, 0.06 + Math.random() * 0.05, vol); }
  function bird(dest, t) {                            // a short phrase of 3-6 chirps
    const base = 2200 + Math.random() * 1600, n = 3 + ((Math.random() * 4) | 0), pan = ac.createStereoPanner ? ac.createStereoPanner() : null, out = pan ? (pan.pan.value = Math.random() * 1.6 - 0.8, pan.connect(dest), pan) : dest;
    for (let i = 0; i < n; i++) { const f = base * (0.85 + Math.random() * 0.4); tone(out, 'sine', f, f * (1.15 + Math.random() * 0.35), t + i * (0.09 + Math.random() * 0.07), 0.07, 0.022); }
  }
  // ---------- positional sources ----------
  const SOURCES = {
    waterfall(ctx, out) { chain(noise(1), filt('bandpass', 900, 0.4), filt('lowpass', 3200), gain(0.55), out); chain(noise(0.4), filt('lowpass', 300), gain(0.35), out); },
    fire(ctx, out) { const roar = gain(0.7); chain(noise(0.3), filt('lowpass', 520), roar, breathe(ctx, GUSTS.roar).add(), out); lfo(roar.gain, 1.7, 0.18);
      every(ctx, 0.16, 0.12, (t) => { if (Math.random() < 0.6) return; const s = noise(1.5), g = gain(0.0001); chain(s, filt('highpass', 1800), g, out); const v = 0.12 + Math.random() * 0.2; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + Math.random() * 0.03); s.stop(t + 0.06); }); },
    // lake laps: every shore source in a realm shares one rhythm, so the quiet moments really are quiet.
    // Peak 0.2 (it used to swing up to 0.28 nonstop).
    shore(ctx, out) { const laps = ctx.laps || (ctx.laps = breathe(ctx, GUSTS.laps)); chain(noise(0.6), filt('lowpass', 650, 0.6), gain(0.2), laps.add(), out); },
    bubbles(ctx, out) { every(ctx, 0.35, 0.3, (t) => bubble(out, t, 0.08)); },
    chimes(ctx, out) { const N = [1568, 1760, 2093, 2349, 2637, 3136]; every(ctx, 2.6, 1.6, (t) => { const f = N[(Math.random() * N.length) | 0]; tone(out, 'sine', f, f, t, 2.4, 0.05); tone(out, 'sine', f * 2.01, f * 2.01, t, 0.9, 0.012); }); },
    wings(ctx, out) { every(ctx, 5, 3, (t) => wingBeat(out, t, 0.22)); },
  };
  const panner = (p, r) => {
    const pn = ac.createPanner(); pn.panningModel = 'equalpower'; pn.distanceModel = 'linear'; pn.refDistance = Math.max(1.5, r * 0.08); pn.maxDistance = r; pn.rolloffFactor = 1;
    if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
    return pn;
  };

  // ---------- switching realms: fade the old soundscape out and the new one in ----------
  A.setZone = (id, sources = [], rebuild = false) => {
    if (!ac) { want = { id, sources }; return; }
    if (zone && zone.id === id && !rebuild) return;
    const old = zone;
    if (old) { old.out.gain.cancelScheduledValues(now()); old.out.gain.setTargetAtTime(0, now(), 0.35); old.dead = true; setTimeout(() => dispose(old), 2200); }
    const ctx = zone = { id, sources, out: ac.createGain(), timers: [], dead: false, uses: {} };
    ctx.out.gain.value = 0; ctx.out.connect(ambBus); ctx.out.gain.setTargetAtTime(1, now() + 0.1, rebuild ? 0.05 : 0.5);
    ctx.uses[id] = 1;
    if (files[id]) chain(fileLoop(id, 0.8), ctx.out); else if (BEDS[id]) BEDS[id](ctx);
    for (const s of sources) {
      ctx.uses[s.kind] = 1;
      const pn = panner(s.pos, s.r || 20), g = gain(s.gain == null ? 1 : s.gain); chain(g, pn, ctx.out);
      if (files[s.kind]) chain(fileLoop(s.kind, 1), g); else if (SOURCES[s.kind]) SOURCES[s.kind](ctx, g);
    }
  };
  function dispose(ctx) { for (const id of ctx.timers) clearInterval(id); try { ctx.out.disconnect(); } catch (e) { /* gone */ } }

  // where the ears are: the player's head, facing the way the camera looks
  A.listen = (p, f) => {
    if (!ac) return; const L = ac.listener;
    if (L.positionX) { const t = now(); L.positionX.setTargetAtTime(p.x, t, 0.05); L.positionY.setTargetAtTime(p.y, t, 0.05); L.positionZ.setTargetAtTime(p.z, t, 0.05);
      L.forwardX.setTargetAtTime(f.x, t, 0.05); L.forwardY.setTargetAtTime(f.y, t, 0.05); L.forwardZ.setTargetAtTime(f.z, t, 0.05); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  };

  // ---------- an optional, very soft pad: two slow chords, no melody ----------
  let pad = null;
  function startPad() {
    if (pad || !ac) return;
    const out = gain(0.0001), lp = filt('lowpass', 700, 0.4); chain(lp, out, padBus); lfo(lp.frequency, 0.03, 260);
    out.gain.setTargetAtTime(0.06, now(), 2.5);
    const CH = [[130.81, 196, 246.94, 329.63], [110, 164.81, 220, 277.18]];      // Cmaj7-ish and A-ish, slowly alternating
    const vs = CH[0].map((f, i) => { const o = ac.createOscillator(), o2 = ac.createOscillator(), g = gain(0.25); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.003; chain(o, g); chain(o2, g); chain(g, lp); o.start(); o2.start(); return [o, o2]; });
    let k = 0; const id = setInterval(() => { k ^= 1; vs.forEach(([o, o2], i) => { o.frequency.setTargetAtTime(CH[k][i], now(), 3); o2.frequency.setTargetAtTime(CH[k][i] * 1.003, now(), 3); }); }, 16000);
    pad = { out, vs, id };
  }
  function stopPad() { if (!pad) return; const p = pad; pad = null; clearInterval(p.id); p.out.gain.setTargetAtTime(0.0001, now(), 0.6); setTimeout(() => p.vs.forEach(([o, o2]) => { o.stop(); o2.stop(); }), 2500); }

  // ---------- sound effects ----------
  const SFX = {
    click: (t) => tone(fxBus, 'sine', 740, 1100, t, 0.09, 0.07),
    pop: (t) => { tone(fxBus, 'triangle', 520, 880, t, 0.1, 0.07); tone(fxBus, 'sine', 1320, 1320, t + 0.05, 0.12, 0.04); },
    sparkle: (t) => [1568, 2093, 2637].forEach((f, i) => tone(fxBus, 'sine', f, f, t + i * 0.05, 0.25, 0.035)),
    portal: (t) => { tone(fxBus, 'sine', 260, 1040, t, 0.5, 0.06); tone(fxBus, 'triangle', 390, 1560, t + 0.06, 0.5, 0.03); },
    start: (t) => [523.25, 659.25, 783.99].forEach((f, i) => tone(fxBus, 'sine', f, f, t + i * 0.1, 0.5, 0.08)),
    chime: (t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(fxBus, 'sine', f, f, t + i * 0.24, 1.6, 0.14); tone(fxBus, 'sine', f * 2, f * 2, t + i * 0.24, 0.8, 0.03); }),
  };
  A.sfx = (name) => {
    if (!ac || !SFX[name]) return;
    const t = performance.now(), gap = name === 'sparkle' ? 260 : 60;          // don't machine-gun
    if (t - (lastPlayed[name] || 0) < gap) return;
    lastPlayed[name] = t;
    try { if (ac.state === 'suspended') ac.resume(); SFX[name](now() + 0.01); } catch (e) { /* silent */ }
  };

  // ---------- switches and sliders (all remembered) ----------
  A.setAmbience = (on) => { A.ambienceOn = !!on; store('fablenook.ambience', on ? '1' : '0'); if (ac) ambBus.gain.setTargetAtTime(on ? A.vol.ambience : 0, now(), 0.4); };
  A.setPad = (on) => { A.padOn = !!on; store('fablenook.pad', on ? '1' : '0'); if (!ac) return; if (on) startPad(); else stopPad(); };
  A.setVolume = (bus, v) => {
    v = FN.clamp(+v || 0, 0, 1); A.vol[bus] = v; store(bus === 'effects' ? 'fablenook.volFx' : 'fablenook.volAmb', String(v));
    if (!ac) return;
    if (bus === 'effects') fxBus.gain.setTargetAtTime(v, now(), 0.05);
    else { if (A.ambienceOn) ambBus.gain.setTargetAtTime(v, now(), 0.1); padBus.gain.setTargetAtTime(v, now(), 0.1); }
  };
  A.setMuted = (m) => {
    A.muted = !!m; store('fablenook.muted', m ? '1' : '0');
    if (ac) { master.gain.cancelScheduledValues(now()); master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.05); }
  };
  A.state = () => ({ ctx: ac ? ac.state : 'none', zone: zone && zone.id, sources: zone ? zone.sources.length : 0, master: ac ? master.gain.value : 0, amb: ac ? ambBus.gain.value : 0, fx: ac ? fxBus.gain.value : 0, pad: !!pad, files: Object.keys(files) });
  // output level (RMS of the ambience bus), used by the automated sound test
  let meter = null;
  A.level = () => { if (!ac) return 0; if (!meter) { meter = ac.createAnalyser(); meter.fftSize = 2048; ambBus.connect(meter); } const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); };
  A._zone = () => zone;                               // for tests: the live soundscape (its breaths = the come-and-go envelopes)
  // pad bus follows the ambience slider
  const _u = A.unlock; A.unlock = () => { _u(); if (ac) padBus.gain.value = A.vol.ambience; };
})(window.FN);
