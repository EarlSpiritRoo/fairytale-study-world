/* ============================================================
   core.js — tiny shared helpers + the zone registry that
   study.js validates against. Loaded before net/study/audio.
   ============================================================ */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  FN.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  FN.lerp = (a, b, t) => a + (b - a) * t;
  FN.fmt = (ms) => {                              // ms -> "mm:ss"
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  // ids only: study.js checks circle sessions and ledger rows against this list (the 3D details live in js3d/kit.js)
  FN.ZONES = { skyfield: 1, lagoon: 1, hollyhollow: 1, pavilion: 1, petalwood: 1 };
  FN.ZONE_ORDER = Object.keys(FN.ZONES);
  // Study Circle ids -> their realm. A realm's first circle uses the realm id; extra circles are 'realm.key'.
  FN.CIRCLES = Object.assign({}, ...FN.ZONE_ORDER.map((z) => ({ [z]: z })), { 'skyfield.library': 'skyfield' });
  // slow day → sunset → day cycle driven by the wall clock, so every visitor sees the same sky
  FN.sunset = (now) => 0.5 - 0.5 * Math.cos((now % 240000) / 240000 * Math.PI * 2);
})(window.FN);
