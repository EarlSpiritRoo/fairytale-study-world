/* ============================================================
   toon.js — the 3D STYLE KIT (magical Y2K, cel-shaded).
   Everything visible is built from these few materials, so the
   whole world can be restyled here.

   toon(color)        cel-shaded material (cached per colour)
   outline(mesh)      soft ink outline (inverted hull)
   holo()             iridescent material: crystals, wings, domes
   opal()             opal glass that shifts pink / aqua / gold with the view (the Opal Spire)
   glow(color, size)  additive glow sprite (cheap "bloom")
   Batch              collects repeated props → InstancedMesh
   THEME              palette shared with the CSS
   ============================================================ */
import * as THREE from 'three';

export const THEME = {
  holo: ['#ffb3e6', '#d9b8ff', '#b5d8ff', '#b8ffe9', '#fff3b0'],     // pink · lilac · baby blue · mint · butter
  ink: '#7a5aa6',
  grass: '#bff3d6', grassDark: '#9be6cc', cliff: '#d9c6ff', keel: '#c3adff',
  pearl: '#fff4fb', gold: '#ffe07a', cloud: '#ffffff',
};

// ---------- cel shading: a 4-step light ramp ----------
const ramp = new THREE.DataTexture(new Uint8Array([120, 185, 230, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;

const toonCache = new Map();
export function toon(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!toonCache.has(key)) toonCache.set(key, new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, opts)));
  return toonCache.get(key);
}
export const flat = (color, opts) => new THREE.MeshBasicMaterial(Object.assign({ color }, opts));

// ---------- ink outline: back faces pushed out along the normal, constant thickness on screen-ish ----------
export const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(THEME.ink) }, uT: { value: 0.022 } }]),
  vertexShader: `
    uniform float uT;
    #include <common>
    #include <fog_pars_vertex>
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      mvPosition.xyz += normalize(normalMatrix * normal) * uT;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    uniform vec3 uColor;
    #include <common>
    #include <fog_pars_fragment>
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
      #include <fog_fragment>
      #include <colorspace_fragment>
    }`,
});
export const outlines = [];                           // every outline mesh, so low-quality mode can hide them
export function outline(mesh) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.userData.outline = true; outlines.push(o); mesh.add(o);
  return mesh;
}

// ---------- iridescent "holo" material (works with instancing and fog) ----------
export const uTime = { value: 0 };                    // shared clock for every animated shader
export const uPointScale = { value: 300 };            // pixels per metre at 1 m for Points (set from the viewport size)
const holoCache = {};
export function holo(alpha = 1, doubleSide = false) {
  const key = alpha + '|' + doubleSide;
  if (holoCache[key]) return holoCache[key];
  return (holoCache[key] = new THREE.ShaderMaterial({
    fog: true, transparent: alpha < 1, depthWrite: alpha >= 1, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAlpha: { value: alpha } }]), { uTime }),
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        #ifdef USE_INSTANCING
          mat4 m = modelMatrix * instanceMatrix;
        #else
          mat4 m = modelMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(m) * normal); vV = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main() {
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        float f = 1.0 - max(dot(n, normalize(vV)), 0.0);                    // fresnel: colour shifts with the viewing angle
        vec3 c = mix(vec3(1.0), pal(f * 0.9 + vW.y * 0.11 + vW.x * 0.05 + uTime * 0.04), 0.36);
        c = mix(c, vec3(1.0), pow(f, 3.0) * 0.7);                          // pearly rim
        c *= 0.86 + 0.14 * step(0.0, dot(n, normalize(vec3(0.4, 0.8, 0.3))));  // one hard toon shadow step
        gl_FragColor = vec4(c, uAlpha);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

// ---------- opal glass: the Opal Spire. Pink / aqua / gold that shifts with the viewing angle ----------
// Not lit by the scene lights (like holo), so it stays luminous at golden hour. `glowAmt` adds a soft inner light.
const opalCache = {};
export function opal(tint = '#fff4fb', glowAmt = 0) {
  const key = tint + '|' + glowAmt;
  if (opalCache[key]) return opalCache[key];
  return (opalCache[key] = new THREE.ShaderMaterial({
    fog: true,
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTint: { value: new THREE.Color(tint) }, uGlow: { value: glowAmt } }]), { uTime }),
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        #ifdef USE_INSTANCING
          mat4 m = modelMatrix * instanceMatrix;
        #else
          mat4 m = modelMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(m) * normal); vV = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uTint; uniform float uGlow;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      vec3 opalPal(float t) {                                   // pink -> aqua -> gold -> pink
        vec3 a = vec3(1.0, 0.72, 0.87), b = vec3(0.62, 0.95, 0.95), c = vec3(1.0, 0.88, 0.6);
        t = fract(t) * 3.0;
        return t < 1.0 ? mix(a, b, t) : t < 2.0 ? mix(b, c, t - 1.0) : mix(c, a, t - 2.0);
      }
      void main() {
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(vV);
        float f = 1.0 - max(dot(n, v), 0.0);                    // fresnel: the colour slides as you walk around it
        vec3 c = pow(opalPal(f * 1.1 + dot(n, vec3(0.3, 0.5, 0.2)) * 0.45 + vW.y * 0.03 + vW.x * 0.012 + uTime * 0.02), vec3(2.2));   // to linear: keeps the pastels from washing out
        c = mix(uTint, c, 0.72 + 0.22 * f);
        c = mix(c, vec3(1.0, 0.97, 0.93), pow(f, 4.0) * 0.5);   // pearly rim
        c *= 0.8 + 0.2 * step(0.0, dot(n, normalize(vec3(0.5, 0.7, -0.4))));
        c += uGlow * vec3(1.0, 0.85, 0.65) * (0.35 + 0.25 * sin(uTime * 0.8 + vW.y * 0.3));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

// ---------- glow sprites ----------
const glowTex = {};
function radialTexture(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function glow(color, size, opacity = 0.8) {
  const tex = glowTex.soft || (glowTex.soft = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.4)'));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size); return s;
}
// four-point ✦ texture for sparkle particles
export function starTexture() {
  if (glowTex.star) return glowTex.star;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.translate(32, 32); g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill();
  return (glowTex.star = new THREE.CanvasTexture(cv));
}
// soft dark disc used as a blob shadow
export const blobMat = new THREE.MeshBasicMaterial({ map: null, color: '#5a46a0', transparent: true, opacity: 0.22, depthWrite: false });
export function blobTexture() { return glowTex.blob || (glowTex.blob = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.75)')); }

// ============================================================
//  Batch — add the same geometry+material many times, get ONE
//  draw call back (InstancedMesh). Use for every repeated prop.
//    batch.add('flower', geo, mat, position, { scale, rotY, color, quat })
//    batch.build(scene)
// ============================================================
export class Batch {
  constructor() { this.sets = new Map(); this.dummy = new THREE.Object3D(); }
  add(key, geo, mat, pos, o = {}) {
    let set = this.sets.get(key); if (!set) this.sets.set(key, (set = { geo, mat, items: [] }));
    const d = this.dummy;
    d.position.copy(pos); d.rotation.set(o.rotX || 0, o.rotY || 0, o.rotZ || 0);
    if (o.lookAt) d.lookAt(o.lookAt);
    if (typeof o.scale === 'number') d.scale.setScalar(o.scale); else if (o.scale) d.scale.set(...o.scale); else d.scale.setScalar(1);
    d.updateMatrix();
    set.items.push({ m: d.matrix.clone(), color: o.color });
  }
  build(parent) {
    const out = {};
    for (const [key, set] of this.sets) {
      const im = new THREE.InstancedMesh(set.geo, set.mat, set.items.length);
      set.items.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.color) im.setColorAt(i, new THREE.Color(it.color)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.name = key;
      parent.add(im); out[key] = im;
    }
    return out;
  }
}

// small seeded random so the world is identical for every visitor
export function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
