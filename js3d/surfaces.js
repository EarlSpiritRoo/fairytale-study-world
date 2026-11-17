/* ============================================================
   surfaces.js — three special animated materials:
   causticMat   sand with rippling light (Coral Lagoon floor)
   waterMat     night lake with a shimmering moon path (Pavilion)
   kelpMat      swaying kelp blades (instanced)
   All of them respect scene fog.
   ============================================================ */
import * as THREE from 'three';
import { uTime } from './toon.js';

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
