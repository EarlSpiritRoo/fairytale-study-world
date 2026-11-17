/* ============================================================
   env.js — everything around a zone that is shared by all of
   them: the sky dome, drifting clouds and far islets, the
   pegasi, sparkles (ambient + burst/trail pool) and "weather"
   (snow, bubbles, petals, fireflies).

   Each zone describes what it wants with plain data (zone.env):
     sky:     { day: [top, mid, bottom], eve: [...] }   colours
     cycle:   true = slow day → sunset shift (false = fixed)
     stars:   0..1 always-on stars       moon: true = pearl moon
     aurora:  0..1 curtains              glow: sun/moon halo strength
     sunDir:  [x, y, z]
     fog:     { day, eve, near, far }
     hemi:    [skyColour, groundColour, intensity]
     sun:     [colour, intensity, eveningColour]
     clouds / flyers: booleans
     weather: { kind, vel: [x,y,z], size, color, sway, twinkle, n, box: [x,y,z], ring }
     sparkle: [[cx, cy, cz, radius, height], …]         where the ambient ✦ live
   ============================================================ */
import * as THREE from 'three';
import { toon, flat, starTexture, blobTexture, Batch, rng, THEME, uTime } from './toon.js';
import { makePet } from './character.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createEnv(scene) {
  const R = rng(4242), tmpA = new THREE.Color(), tmpB = new THREE.Color();
  const mixCol = (out, a, b, t) => out.copy(tmpA.set(a)).lerp(tmpB.set(b), t);

  // ---------- sky dome ----------
  const U = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, uSun: { value: V(0.5, 0.45, -0.75).normalize() },
    uStars: { value: 0 }, uAurora: { value: 0 }, uDisc: { value: 0.9993 }, uGlow: { value: 1 }, uTime };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunCol; uniform vec3 uSun; uniform float uStars; uniform float uAurora; uniform float uDisc; uniform float uGlow; uniform float uTime; varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(bot, mid, smoothstep(-0.25, 0.12, d.y)); c = mix(c, top, smoothstep(0.1, 0.75, d.y));
        float s = max(dot(d, uSun), 0.0);
        c += sunCol * ((pow(s, 6.0) * 0.35 + pow(s, 90.0) * 0.6) * uGlow + smoothstep(uDisc, uDisc + 0.0003, s));    // halo + sun / moon disc
        float n = hash(floor(d * 70.0));
        c += vec3(step(0.994, n) * (0.5 + 0.5 * sin(uTime * 2.0 + n * 90.0)) * uStars * smoothstep(-0.05, 0.3, d.y));
        if (uAurora > 0.0) {                                                                                       // aurora: wavy curtains with fine vertical rays
          float ang = atan(d.z, d.x), band = smoothstep(0.06, 0.3, d.y) * smoothstep(0.95, 0.45, d.y);
          float w = sin(ang * 5.0 + uTime * 0.22 + sin(ang * 9.0 - uTime * 0.35) * 0.9), rays = 0.6 + 0.4 * sin(ang * 70.0 + uTime * 0.8);
          c += (vec3(0.25, 1.0, 0.7) * pow(max(w, 0.0), 2.5) + vec3(0.85, 0.4, 1.0) * pow(max(-w, 0.0), 3.0) * 0.6) * band * rays * uAurora * 0.6;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  // ---------- drifting clouds + far floating islets (two instanced meshes on one slowly turning ring) ----------
  const cloudRing = new THREE.Group(); scene.add(cloudRing);
  { const puff = new THREE.IcosahedronGeometry(1, 1), cb = new Batch(), cm = flat('#ffffff', { fog: true }), cm2 = flat('#ffeaf8', { fog: true });
    for (let c = 0; c < 22; c++) { const a = R() * 6.283, d = 55 + R() * 120, y = -22 + R() * 60, s = 3 + R() * 6, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      for (let k = 0; k < 5; k++) cb.add(c % 2 ? 'cloudA' : 'cloudB', puff, c % 2 ? cm : cm2, V(cx + (k - 2) * s * 0.75 + R() * s * 0.3, y + R() * s * 0.25 - Math.abs(k - 2) * s * 0.12, cz + (R() - 0.5) * s), { scale: [s * (1 - Math.abs(k - 2) * 0.16), s * 0.55, s * 0.8] }); }
    for (let i = 0; i < 9; i++) { const a = R() * 6.283, d = 70 + R() * 90, y = -15 + R() * 45, s = 2 + R() * 3.5, p = V(Math.cos(a) * d, y, Math.sin(a) * d);
      cb.add('isletTop', new THREE.CylinderGeometry(1, 0.85, 0.3, 10), toon(THEME.grass), p, { scale: s }); cb.add('isletKeel', new THREE.ConeGeometry(0.85, 1.6, 7).rotateX(Math.PI), toon(THEME.keel), p.clone().setY(y - 0.95 * s), { scale: s }); cb.add('cloudA', puff, cm, p.clone().setY(y - 0.1 * s), { scale: [s * 1.25, s * 0.3, s * 1.25] }); }
    cb.build(cloudRing); }
  // winged horses crossing the sky
  const flyers = [0, 1].map((i) => { const p = makePet('pegasus', 4.5 + i, i ? '#ffeaf6' : '#ffffff'); scene.add(p.group); return { p, r: 62 + i * 26, y: 16 + i * 9, sp: (i ? -1 : 1) * (0.055 + i * 0.02), a: i * 3 }; });

  // ---------- sparkles: the first AMBIENT points twinkle in place, the rest are a pool for bursts and trails ----------
  const AMBIENT = 260, POOL_N = 150, N = AMBIENT + POOL_N;
  const sp = { pos: new Float32Array(N * 3), size: new Float32Array(N), phase: new Float32Array(N), col: new Float32Array(N * 3), vel: new Float32Array(POOL_N * 3), life: new Float32Array(POOL_N), next: 0 };
  for (let i = 0; i < N; i++) { sp.phase[i] = i < AMBIENT ? R() * 6.28 : -1; sp.col.set([1, 1, 1], i * 3); }
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3)); spGeo.setAttribute('aSize', new THREE.BufferAttribute(sp.size, 1));
  spGeo.setAttribute('aPhase', new THREE.BufferAttribute(sp.phase, 1)); spGeo.setAttribute('aCol', new THREE.BufferAttribute(sp.col, 3));
  const sparkles = new THREE.Points(spGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uMap: { value: starTexture() }, uScale: { value: 300 } },
    vertexShader: `attribute float aSize; attribute float aPhase; attribute vec3 aCol; uniform float uTime; uniform float uScale; varying vec3 vC; varying float vA;
      void main() { vC = aCol; float tw = aPhase < 0.0 ? 1.0 : max(0.0, sin(uTime * 1.6 + aPhase)); vA = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * tw * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform sampler2D uMap; varying vec3 vC; varying float vA; void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.a * vA, t.a * vA); }',
  }));
  sparkles.frustumCulled = false; scene.add(sparkles);
  const holoCols = THEME.holo.map((h) => new THREE.Color(h));
  function emit(pos, spread, up, size, life) {
    const k = sp.next; sp.next = (sp.next + 1) % POOL_N; const i = AMBIENT + k;
    sp.pos.set([pos.x, pos.y, pos.z], i * 3); sp.vel.set([(Math.random() - 0.5) * spread, up + Math.random() * spread * 0.5, (Math.random() - 0.5) * spread], k * 3);
    sp.life[k] = life; sp.size[i] = size; const c = holoCols[(Math.random() * 5) | 0]; sp.col.set([c.r, c.g, c.b], i * 3);
  }
  const burst = (pos, n = 14) => { for (let i = 0; i < n; i++) emit(pos, 2.4, 1.2, 0.5 + Math.random() * 0.5, 0.7 + Math.random() * 0.5); };
  const trail = (pos) => emit(pos, 0.5, 0.3, 0.3 + Math.random() * 0.25, 0.6);

  // ---------- weather: one Points cloud that wraps around the camera, animated entirely in the vertex shader ----------
  const WN = 520, seeds = new Float32Array(WN * 3), rnd = new Float32Array(WN);
  for (let i = 0; i < WN; i++) { seeds.set([R(), R(), R()], i * 3); rnd[i] = R(); }
  const wGeo = new THREE.BufferGeometry(); wGeo.setAttribute('position', new THREE.BufferAttribute(seeds, 3)); wGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  const ringTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, 6.3); g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(22, 22, 5, 0, 6.3); g.fill(); return new THREE.CanvasTexture(cv); })();
  const WU = { uTime, uCam: { value: V(0, 0, 0) }, uBox: { value: V(40, 20, 40) }, uVel: { value: V(0, -1, 0) }, uSway: { value: 0.5 }, uSize: { value: 0.2 }, uColor: { value: new THREE.Color('#fff') }, uTwinkle: { value: 0 }, uScale: { value: 300 }, uMap: { value: blobTexture() } };
  const weather = new THREE.Points(wGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: WU,
    vertexShader: `attribute float aRand; uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uVel; uniform float uSway; uniform float uSize; uniform float uTwinkle; uniform float uScale; varying float vA;
      void main() {
        vec3 p = position * uBox + uVel * uTime * (0.6 + 0.8 * aRand);
        p.x += sin(uTime * (0.5 + aRand) + aRand * 40.0) * uSway; p.z += cos(uTime * (0.4 + aRand) + aRand * 20.0) * uSway; p.y += sin(uTime * 0.7 + aRand * 60.0) * uSway * 0.5;
        vec3 q = mod(p - uCam, uBox) - 0.5 * uBox;                                  // wrap into a box centred on the camera
        float tw = mix(1.0, max(0.0, sin(uTime * (1.0 + aRand * 2.0) + aRand * 30.0)), uTwinkle);
        vA = tw * smoothstep(uBox.x * 0.5, uBox.x * 0.36, length(q.xz));
        vec4 mv = viewMatrix * vec4(uCam + q, 1.0);
        gl_PointSize = uSize * (0.6 + 0.8 * aRand) * (0.4 + 0.6 * tw) * uScale / -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uColor * a, a); }',
  }));
  weather.material.blending = THREE.CustomBlending; weather.material.blendSrc = THREE.OneFactor; weather.material.blendDst = THREE.OneMinusSrcAlphaFactor;   // premultiplied: works on dark and light backgrounds
  weather.frustumCulled = false; weather.visible = false; scene.add(weather);

  // ---------- per zone ----------
  let cur = null, low = false;
  function apply(zone) {
    const e = cur = zone.env;
    cloudRing.visible = !!e.clouds; for (const f of flyers) f.p.group.visible = !!e.flyers;
    // ambient sparkles scattered over the zone's listed areas
    const areas = e.sparkle || [[0, 0, 0, 30, 7]];
    for (let i = 0; i < AMBIENT; i++) { const a = areas[i % areas.length], an = R() * 6.283, d = Math.sqrt(R()) * a[3]; sp.pos.set([a[0] + Math.cos(an) * d, a[1] + 0.3 + R() * a[4], a[2] + Math.sin(an) * d], i * 3); sp.size[i] = 0.25 + R() * 0.45; tmpA.set(e.sparkleCol || THEME.holo[i % 5]).lerp(tmpB.set('#ffffff'), 0.5); sp.col.set([tmpA.r, tmpA.g, tmpA.b], i * 3); }
    for (let k = 0; k < POOL_N; k++) { sp.life[k] = 0; sp.size[AMBIENT + k] = 0; }
    const w = e.weather; weather.visible = !!w;
    if (w) { WU.uVel.value.set(...w.vel); WU.uSway.value = w.sway || 0; WU.uSize.value = w.size; WU.uColor.value.set(w.color); WU.uTwinkle.value = w.twinkle || 0; WU.uBox.value.set(...(w.box || [44, 22, 44])); WU.uMap.value = w.ring ? ringTex : blobTexture(); wGeo.setDrawRange(0, Math.round((w.n || WN) * (low ? 0.5 : 1))); }
    U.uDisc.value = e.moon ? 0.9982 : 0.9993; U.uGlow.value = e.glow == null ? 1 : e.glow; U.uAurora.value = e.aurora || 0;
  }
  function update(dt, t, sunset, camPos, fog, hemi, sun) {
    const e = cur; if (!e) return;
    uTime.value = t;
    const s = e.cycle ? sunset : 0, eve = e.sky.eve || e.sky.day;
    mixCol(U.top.value, e.sky.day[0], eve[0], s); mixCol(U.mid.value, e.sky.day[1], eve[1], s); mixCol(U.bot.value, e.sky.day[2], eve[2], s);
    mixCol(U.sunCol.value, e.sun[0], e.sun[2] || e.sun[0], s); U.uStars.value = Math.max(e.stars || 0, e.cycle ? Math.max(0, s - 0.3) * 1.4 : 0);
    const sd = e.sunDir || [0.5, 0.5, -0.75]; U.uSun.value.set(sd[0], sd[1] - (e.cycle ? s * 0.34 : 0), sd[2]).normalize();
    sky.position.copy(camPos); WU.uCam.value.copy(camPos);
    // fog and lights follow the sky
    mixCol(fog.color, e.fog.day, e.fog.eve || e.fog.day, s); fog.near = e.fog.near; fog.far = e.fog.far * (low ? 0.75 : 1);
    hemi.color.set(e.hemi[0]); mixCol(hemi.groundColor, e.hemi[1], e.hemi[3] || e.hemi[1], s); hemi.intensity = e.hemi[2];
    mixCol(sun.color, e.sun[0], e.sun[2] || e.sun[0], s); sun.intensity = e.sun[1]; sun.position.copy(U.uSun.value).multiplyScalar(60);

    if (e.clouds) cloudRing.rotation.y = t * 0.006;
    if (e.flyers) for (const f of flyers) { f.a += dt * f.sp; f.p.group.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(t * 0.5 + f.r) * 3, Math.sin(f.a) * f.r); f.p.group.rotation.y = -f.a + (f.sp > 0 ? 0 : Math.PI); f.p.update(dt, { move: 1, fly: true }); }
    for (let k = 0; k < POOL_N; k++) {                     // sparkle pool physics
      if (sp.life[k] <= 0) continue; const i = AMBIENT + k; sp.life[k] -= dt;
      sp.pos[i * 3] += sp.vel[k * 3] * dt; sp.pos[i * 3 + 1] += sp.vel[k * 3 + 1] * dt; sp.pos[i * 3 + 2] += sp.vel[k * 3 + 2] * dt;
      sp.vel[k * 3] *= 1 - 2 * dt; sp.vel[k * 3 + 2] *= 1 - 2 * dt; sp.vel[k * 3 + 1] -= 1.2 * dt;
      if (sp.life[k] <= 0) sp.size[i] = 0; else sp.size[i] *= 1 - 1.4 * dt;
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.aSize.needsUpdate = true; spGeo.attributes.aCol.needsUpdate = true;
  }
  function setLow(v) { low = v; sparkles.visible = !v; if (cur && cur.weather) wGeo.setDrawRange(0, Math.round((cur.weather.n || WN) * (v ? 0.5 : 1))); }
  const setScale = (s) => { sparkles.material.uniforms.uScale.value = s; WU.uScale.value = s; };

  return { apply, update, setLow, setScale, burst, trail };
}
