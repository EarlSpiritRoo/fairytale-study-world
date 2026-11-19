/* ============================================================
   surfaces.js — three special animated materials:
   causticMat   sand with rippling light (Coral Lagoon floor)
   waterMat     night lake with a shimmering moon path (Pavilion)
   kelpMat      swaying kelp blades (instanced)
   All of them respect scene fog.
   ============================================================ */
import * as THREE from 'three';
import { uTime, uPointScale } from './toon.js';

const FOG_V = '#include <common>\n#include <fog_pars_vertex>', FOG_F = '#include <common>\n#include <fog_pars_fragment>';
const uni = (o) => Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog, o]), { uTime });

export function causticMat(sand = '#f3dcbc', tint = '#7fd6e0', strength = 0.3) {
  return new THREE.ShaderMaterial({
    fog: true, uniforms: uni({ uA: { value: new THREE.Color(sand) }, uB: { value: new THREE.Color(tint) }, uS: { value: strength } }),
    vertexShader: `varying vec3 vW; varying vec3 vN;
      ${FOG_V}
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uS; varying vec3 vW; varying vec3 vN;
      ${FOG_F}
      float web(vec2 p, float t) {                       // cheap caustics: warped sine lattice, sharpened into bright lines
        float v = 0.0;
        for (int i = 0; i < 3; i++) { p += vec2(sin(p.y * 1.3 + t * 0.7), cos(p.x * 1.1 - t * 0.6)) * 0.7; v += abs(sin(p.x * 1.6 + t) + sin(p.y * 1.8 - t * 0.8)); }
        return pow(max(0.0, 1.0 - v / 6.0), 3.0);
      }
      void main() {
        float up = step(0.5, vN.y);                      // only the tops catch the light
        vec3 c = mix(uA, uB, 0.35 + 0.25 * sin(vW.x * 0.21) * sin(vW.z * 0.17)) * (0.78 + 0.22 * up);
        c += vec3(0.9, 1.0, 1.0) * (web(vW.xz * 0.55, uTime) + 0.6 * web(vW.xz * 0.31 + 7.0, uTime * 0.7)) * uS * up;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function waterMat(moonDir = [0.35, 0.42, -0.84]) {
  return new THREE.ShaderMaterial({
    fog: true, uniforms: uni({ uMoon: { value: new THREE.Vector3(...moonDir).normalize() }, uDeep: { value: new THREE.Color('#1b2a70') }, uShallow: { value: new THREE.Color('#3b55b0') } }),
    vertexShader: `varying vec3 vW;
      ${FOG_V}
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uMoon; uniform vec3 uDeep; uniform vec3 uShallow; varying vec3 vW;
      ${FOG_F}
      void main() {
        vec2 p = vW.xz; float t = uTime;
        vec2 rip = vec2(sin(p.x * 1.3 + t) + sin((p.x + p.y) * 0.9 + t * 0.7), sin(p.y * 1.7 - t * 1.2) + sin((p.x - p.y) * 0.8 - t * 0.5));
        vec3 n = normalize(vec3(rip.x * 0.07, 1.0, rip.y * 0.07));
        vec3 v = normalize(cameraPosition - vW);
        float spec = pow(max(dot(reflect(-v, n), uMoon), 0.0), 55.0);                 // the moon's shimmering path
        float glint = step(0.92, sin(p.x * 3.1 + t * 1.3) * sin(p.y * 2.7 - t)) * 0.12;
        vec3 c = mix(uShallow, uDeep, clamp(length(p) / 90.0, 0.0, 1.0)) + vec3(0.06, 0.08, 0.16) * (rip.x + rip.y) * 0.25;
        c += vec3(1.0, 0.97, 0.85) * (spec * 1.4 + glint);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function kelpMat() {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide, uniforms: uni({ uA: { value: new THREE.Color('#2f9f8c') }, uB: { value: new THREE.Color('#8ff0c8') } }),
    vertexShader: `uniform float uTime; varying float vH;
      ${FOG_V}
      void main() {
        mat4 m = modelMatrix * instanceMatrix; vH = position.y + 0.5;                 // 0 at the root, 1 at the tip
        vec4 wp = m * vec4(position, 1.0);
        float ph = m[3].x * 0.7 + m[3].z * 0.4;
        wp.x += sin(uTime * 1.1 + ph + vH * 2.5) * vH * vH * 0.9; wp.z += cos(uTime * 0.8 + ph) * vH * vH * 0.5;   // sway grows toward the tip
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying float vH;
      ${FOG_F}
      void main() { gl_FragColor = vec4(mix(uA, uB, vH), 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ============================================================
   round 7 additions
   calmWaterMat   slow smooth ripples, low specular, soft fresnel, a blurred
                  shimmering light path and soft reflections of nearby lights
   waterfallMat   flowing streaks for waterfall ribbons (see ribbon geometry in kit)
   mistMat        soft drifting mist puffs (one Points cloud for all of them)
   rainbowMat     translucent rainbow arc for waterfall spray
   starCeilMat    a dark ceiling full of slowly twinkling stars
   ============================================================ */
// o = { deep, shallow, sky, light: [x,y,z] direction to the moon/sun, lightCol, path: strength,
//       lights: [[x,y,z, strength], …] (max 6) with lightsCol, centre: [x,z], radius }
export function calmWaterMat(o = {}) {
  const L = (o.lights || []).slice(0, 6), lp = [], n = L.length;
  for (let i = 0; i < 6; i++) lp.push(new THREE.Vector4(...(L[i] || [0, -999, 0, 0])));
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: uni({
      uDeep: { value: new THREE.Color(o.deep || '#0e1440') }, uShallow: { value: new THREE.Color(o.shallow || '#24306e') }, uSky: { value: new THREE.Color(o.sky || '#5d6cb8') },
      uLight: { value: new THREE.Vector3(...(o.light || [0.35, 0.3, -0.88])).normalize() }, uLightCol: { value: new THREE.Color(o.lightCol || '#fff2d6') }, uPath: { value: o.path == null ? 1 : o.path },
      uLights: { value: lp }, uLightsCol: { value: new THREE.Color(o.lightsCol || '#ffd9a0') }, uN: { value: n },
      uCentre: { value: new THREE.Vector2(...(o.centre || [0, 0])) }, uRadius: { value: o.radius || 80 }, uMotion: { value: o.motion || 0 },
    }),
    vertexShader: `varying vec3 vW;
      ${FOG_V}
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uLight; uniform vec3 uLightCol; uniform float uPath;
      uniform vec4 uLights[6]; uniform vec3 uLightsCol; uniform int uN; uniform vec2 uCentre; uniform float uRadius; uniform float uMotion; varying vec3 vW;
      ${FOG_F}
      // smooth, slow swell: a few long sine waves at odd angles (no small dots or speckles)
      vec2 swell(vec2 p, float t) {
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.55 + t * 0.55) * 0.55;
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 0.83 + t * 0.42) * 0.4;
        g += vec2(0.96, -0.28) * cos(dot(p, vec2(0.96, -0.28)) * 1.21 - t * 0.37) * 0.28;
        g += vec2(0.2, 0.98) * cos(dot(p, vec2(0.2, 0.98)) * 1.77 + t * 0.61) * 0.16;
        return g;
      }
      void main() {
        float t = uTime * (1.0 + 0.7 * uMotion);
        vec2 g = swell(vW.xz, t);
        float amp = 0.045 + 0.05 * uMotion;                                            // motion: slightly stronger, quicker swells
        vec3 n = normalize(vec3(-g.x * amp, 1.0, -g.y * amp));
        vec3 v = normalize(cameraPosition - vW);
        float d = clamp(length(vW.xz - uCentre) / uRadius, 0.0, 1.0);
        vec3 c = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));                       // subtle gradient, darker out to the horizon
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        c = mix(c, uSky, fres * 0.55);                                                // soft fresnel: the sky shows at grazing angles
        // motion: slow ripple bands drifting across the surface (soft light / dark undulations, never dots)
        vec2 q = vW.xz + vec2(sin(vW.z * 0.11 + t * 0.2), cos(vW.x * 0.09 - t * 0.17)) * 2.5;
        float bands = sin(dot(q, vec2(0.62, 0.78)) * 0.85 - t * 0.9) * 0.6 + sin(dot(q, vec2(-0.86, 0.5)) * 0.55 + t * 0.6) * 0.4;
        c *= 1.0 + uMotion * 0.11 * bands; c += uSky * uMotion * 0.06 * max(bands, 0.0);
        vec3 r = reflect(-v, n);
        float a = max(dot(r, uLight), 0.0);
        float shimmer = 0.75 + 0.25 * sin(t * 0.9 + vW.x * 0.35 + vW.z * 0.2) * sin(t * 0.6 - vW.z * 0.27);
        shimmer *= 1.0 - uMotion * 0.45 * (0.5 + 0.5 * sin(vW.z * 1.1 + vW.x * 0.25 - t * 1.6 + sin(vW.x * 0.6 + t * 0.4) * 2.0));   // ripples run along the light path
        c += uLightCol * (pow(a, 22.0) * 0.2 + pow(a, 70.0) * 0.16 * shimmer) * uPath;  // blurred light path, low specular
        for (int i = 0; i < 6; i++) {                                                  // soft lantern / pavilion reflections
          if (i >= uN) break;
          vec3 ld = normalize(uLights[i].xyz - vW);
          float b = max(dot(r, ld), 0.0);
          float fall = 1.0 / (1.0 + 0.02 * dot(uLights[i].xyz - vW, uLights[i].xyz - vW));
          c += uLightsCol * pow(b, 28.0) * uLights[i].w * fall * (0.8 + 0.2 * shimmer);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// waterfall ribbon: vertex attribute aUV = (across 0..1, along 0 at the lip .. 1 at the bottom), aLen = length in metres
const wfCache = {};
export function waterfallMat(col = '#bfe6ff', foam = '#ffffff') {
  const key = col + foam; if (wfCache[key]) return wfCache[key];
  return (wfCache[key] = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: uni({ uCol: { value: new THREE.Color(col) }, uFoam: { value: new THREE.Color(foam) } }),
    vertexShader: `attribute vec2 aUV; attribute float aLen; varying vec2 vUV; varying float vLen;
      ${FOG_V}
      void main() { vUV = aUV; vLen = aLen; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol; uniform vec3 uFoam; varying vec2 vUV; varying float vLen;
      ${FOG_F}
      float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main() {
        float along = vUV.y * vLen, x = vUV.x;
        float speed = 4.0 + 6.0 * vUV.y;                                                // speeds up as it falls
        float s = n1(x * 22.0 + 3.0) * 0.6 + n1(x * 9.0 + 11.0) * 0.4;
        float streak = 0.55 + 0.45 * sin((along * 0.9 - uTime * speed) * (0.6 + s) + s * 20.0);
        float edge = smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x);
        float fade = smoothstep(1.0, 0.7, vUV.y);                                       // dissolves into the clouds / mist
        float lip = smoothstep(0.12, 0.0, vUV.y);                                       // white foam at the lip
        vec3 c = mix(uCol, uFoam, lip * 0.8 + streak * 0.35);
        float a = edge * fade * (0.62 + 0.32 * streak + lip * 0.25);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

// one Points cloud of soft mist puffs.  positions: Float32Array of xyz, sizes: Float32Array
export function mistPoints(positions, sizes, color = '#ffffff', map) {
  const geo = new THREE.BufferGeometry(), n = sizes.length, ph = new Float32Array(n);
  for (let i = 0; i < n; i++) ph[i] = Math.random() * 6.28;
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: Object.assign(uni({ uMap: { value: map }, uCol: { value: new THREE.Color(color) } }), { uScale: uPointScale }),
    vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime; uniform float uScale; varying float vA;
      ${FOG_V}
      void main() { vec3 p = position; float k = fract(uTime * 0.05 + aPhase / 6.28);
        p.y += k * 2.5; p.x += sin(uTime * 0.3 + aPhase) * 0.8;
        vA = sin(k * 3.14159) * 0.55;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_PointSize = aSize * (0.8 + 0.4 * k) * uScale / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uCol; varying float vA;
      ${FOG_F}
      void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uCol, a);
        #include <fog_fragment>
      }`,
  }));
  pts.frustumCulled = false; return pts;
}

// rainbow arc: use with RingGeometry(r0, r1, segs, 1, 0, Math.PI)
export function rainbowMat(r0, r1, opacity = 0.32) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: uni({ uR0: { value: r0 }, uR1: { value: r1 }, uO: { value: opacity } }),
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uR0; uniform float uR1; uniform float uO; varying vec3 vP;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        float r = (length(vP.xy) - uR0) / (uR1 - uR0);                                  // 0 inside (violet) .. 1 outside (red)
        float ang = atan(vP.y, vP.x) / 3.14159;
        vec3 c = hue(0.78 - r * 0.78);
        float a = smoothstep(0.0, 0.15, r) * smoothstep(1.0, 0.85, r) * smoothstep(0.0, 0.3, ang) * smoothstep(1.0, 0.7, ang);
        a *= uO * (0.85 + 0.15 * sin(uTime * 0.7 + ang * 6.0));
        gl_FragColor = vec4(c * a, a);
      }`,
  });
}

export function starCeilMat(top = '#1a1650', bottom = '#3a2f86') {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: uni({ uA: { value: new THREE.Color(top) }, uB: { value: new THREE.Color(bottom) } }),
    vertexShader: 'varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 g = vW.xz * 2.2, id = floor(g), f = fract(g) - 0.5;
        float r = h(id), star = step(0.86, r) * smoothstep(0.16, 0.0, length(f + (vec2(h(id + 3.1), h(id + 7.7)) - 0.5) * 0.5));
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + r * 2.0) + r * 40.0);
        vec3 c = mix(uB, uA, 0.5 + 0.5 * sin(vW.x * 0.25) * sin(vW.z * 0.21));
        c += vec3(1.0, 0.95, 0.8) * star * (0.4 + 0.6 * tw);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
