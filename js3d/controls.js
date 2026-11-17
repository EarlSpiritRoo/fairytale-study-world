/* ============================================================
   controls.js — input, the third-person camera, and movement.

   Input      keyboard (WASD / arrows, Shift = walk, 1-6 actions);
              hold the left button / a finger on the ground to walk
              toward it, quick click / tap = walk to that spot;
              right-drag, trackpad two-finger drag, a second finger
              or a drag on empty sky = look; wheel / pinch anywhere = zoom;
              on touch a joystick appears under the left thumb.
   CameraRig  orbits the player, drifts back behind them while
              they walk, and pulls in when something is in the way.
   tryMove    collision: push-out shapes, then the ground query.
   ============================================================ */
import * as THREE from 'three';
import { lerpAngle } from './kit.js';

const KEYMAP = { w: 'u', a: 'l', s: 'd', d: 'r', arrowup: 'u', arrowleft: 'l', arrowdown: 'd', arrowright: 'r' };

export class Input {
  constructor(canvas, joyEl) {
    this.keys = {}; this.walk = false; this.enabled = false;
    this.lookDX = 0; this.lookDY = 0; this.zoom = 0; this.lastLook = -99;
    this.joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 }; this.touchMove = false;
    this.hold = { id: null, x: 0, y: 0 };                // press-and-hold on the ground: walk toward this screen point
    this.onInteract = () => {}; this.onTap = () => {}; this.onAnyKey = () => {}; this.onAction = () => {};
    this.hitTest = () => false;                          // main.js: is there walkable ground under this screen point?
    const look = new Map();                              // pointerId -> last position (camera drags)
    const downs = new Map();                             // pointerId -> where/when it went down (to tell a tap from a drag)
    let pinch = 0, duo = null;                           // duo: a second finger joined a walking / joystick finger (look, or the start of a pinch?)
    // hand a walking / joystick finger over to the camera so two fingers can pinch
    const toLook = (id, x, y) => {
      if (id === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; joyEl.hidden = true; }
      if (id === this.hold.id) this.hold.id = null;
      look.set(id, { x, y }); pinch = 0; duo = null;
    };

    const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    window.addEventListener('keydown', (e) => {
      if (typing(e) || !this.enabled || e.metaKey || e.ctrlKey) return;
      this.onAnyKey();
      const k = KEYMAP[e.key.toLowerCase()];
      if (k) { this.keys[k] = true; e.preventDefault(); }
      if (e.key === 'Shift') this.walk = true;
      if (e.key.toLowerCase() === 'e' && !e.repeat) this.onInteract();
      if (e.key >= '1' && e.key <= '6' && !e.repeat) this.onAction(+e.key - 1);
    });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) this.keys[k] = false; if (e.key === 'Shift') this.walk = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.walk = false; this.hold.id = null; });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (document.activeElement && document.activeElement.blur && document.activeElement !== canvas) document.activeElement.blur();
      canvas.setPointerCapture(e.pointerId);
      const touch = e.pointerType === 'touch', busy = this.joy.id !== null || this.hold.id !== null || look.size > 0;
      downs.set(e.pointerId, { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, t: e.timeStamp, ok: touch || e.button === 0 });
      // two fingers landing together = a pinch, wherever they land (even on the ground or the joystick corner)
      if (touch && look.size === 0 && (this.hold.id !== null) !== (this.joy.id !== null)) {
        const fid = this.hold.id !== null ? this.hold.id : this.joy.id, f = downs.get(fid);
        if (f && e.timeStamp - f.t < 180) { toLook(fid, f.cx, f.cy); look.set(e.pointerId, { x: e.clientX, y: e.clientY }); downs.get(e.pointerId).ok = false; f.ok = false; return; }
        duo = { a: fid, ax: f.cx, ay: f.cy, b: e.pointerId, bx: e.clientX, by: e.clientY, dx: 0, dy: 0 };   // decide once both move: look or pinch
      }
      const leftThumb = touch && this.joy.id === null && this.hold.id === null && e.clientX < window.innerWidth * 0.45 && e.clientY > window.innerHeight * 0.3;
      if (leftThumb) {                                   // joystick
        Object.assign(this.joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
        joyEl.hidden = false; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.firstElementChild.style.transform = '';
      } else if ((touch ? !busy : e.button === 0) && this.hitTest(e.clientX, e.clientY)) {
        Object.assign(this.hold, { id: e.pointerId, x: e.clientX, y: e.clientY });        // left button / first finger on the ground: hold to walk
      } else look.set(e.pointerId, { x: e.clientX, y: e.clientY });                        // right button, a second finger, or empty sky: look around
    });
    canvas.addEventListener('pointermove', (e) => {
      const dn = downs.get(e.pointerId); if (dn) { dn.cx = e.clientX; dn.cy = e.clientY; }
      if (duo && (e.pointerId === duo.a || e.pointerId === duo.b)) {
        // Pinch = both fingers slide toward or away from each other along the line between them.
        // Anything else (steering with the first finger, sweeping the second) = keep walking + look.
        const A = downs.get(duo.a), B = downs.get(duo.b);
        if (A && B) {
          const ax = A.cx - duo.ax, ay = A.cy - duo.ay, bx = B.cx - duo.bx, by = B.cy - duo.by, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
          let ux = duo.bx - duo.ax, uy = duo.by - duo.ay; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
          const pa = ax * ux + ay * uy, pb = bx * ux + by * uy;
          if (la > 10 && lb > 10 && pa * pb < 0 && Math.abs(pa) > la * 0.8 && Math.abs(pb) > lb * 0.8) {
            const b = look.get(duo.b); if (b) { b.x = B.cx; b.y = B.cy; }
            toLook(duo.a, A.cx, A.cy); return;                      // both fingers now drive the camera: pinch
          }
          if (lb > 40 || la > 60) { this.lookDX += duo.dx; this.lookDY += duo.dy; this.lastLook = performance.now() / 1000; duo = null; }   // decided: look
        }
        if (duo && e.pointerId === duo.b) { const p = look.get(duo.b); if (p) { duo.dx += e.clientX - p.x; duo.dy += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; } return; }   // hold the look until decided
      }
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy; const d = Math.hypot(dx, dy), max = 52;
        if (d > max) { dx *= max / d; dy *= max / d; }
        this.joy.x = dx / max; this.joy.y = dy / max;
        joyEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (e.pointerId === this.hold.id) { this.hold.x = e.clientX; this.hold.y = e.clientY; }
      else if (look.has(e.pointerId)) {
        const p = look.get(e.pointerId);
        if (look.size === 2) {                           // pinch = zoom
          const o = [...look.entries()].find(([id]) => id !== e.pointerId)[1], d = Math.hypot(e.clientX - o.x, e.clientY - o.y);
          if (pinch) this.zoom += (pinch - d) * 0.01; pinch = d;
        } else { this.lookDX += e.clientX - p.x; this.lookDY += e.clientY - p.y; this.lastLook = performance.now() / 1000; }
        p.x = e.clientX; p.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerId === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; joyEl.hidden = true; }
      if (e.pointerId === this.hold.id) this.hold.id = null;
      look.delete(e.pointerId); pinch = 0; if (duo && (e.pointerId === duo.a || e.pointerId === duo.b)) { this.lookDX += duo.dx; this.lookDY += duo.dy; duo = null; }
      const d = downs.get(e.pointerId); downs.delete(e.pointerId);        // a quick press that barely moved = tap / click
      if (d && d.ok && e.type === 'pointerup' && e.timeStamp - d.t < 350 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 9) this.onTap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    // Wheel: a mouse wheel zooms. A trackpad's two-finger drag orbits the camera; its pinch (ctrlKey) zooms.
    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return; e.preventDefault();
      const trackpad = e.deltaMode === 0 && (e.deltaX !== 0 || (e.wheelDeltaY !== undefined && e.wheelDeltaY % 120 !== 0));
      if (e.ctrlKey) this.zoom += e.deltaY * 0.01;
      else if (trackpad) { this.lookDX -= e.deltaX * 0.9; this.lookDY -= e.deltaY * 0.9; this.lastLook = performance.now() / 1000; }
      else this.zoom += e.deltaY * 0.0012;
    }, { passive: false });
  }
  // desired movement in screen terms: x = right, z = forward, each -1..1
  move() {
    const k = this.keys; let x = (k.r ? 1 : 0) - (k.l ? 1 : 0), z = (k.u ? 1 : 0) - (k.d ? 1 : 0);
    this.touchMove = this.joy.id !== null;
    if (this.touchMove) { x = this.joy.x; z = -this.joy.y; }
    return { x, z, mag: Math.min(1, Math.hypot(x, z)) };
  }
}

export class CameraRig {
  constructor(camera, occluders) {
    this.camera = camera; this.occluders = occluders;
    this.yaw = 0; this.pitch = 0.32; this.dist = 6.5; this.cur = 6.5;      // cur = distance after collision
    this.focus = new THREE.Vector3(); this.ray = new THREE.Raycaster(); this.dir = new THREE.Vector3(); this.first = true;
  }
  // focus = point to look at (the player's head); heading = their walking direction or null when standing
  update(dt, focus, heading, input, now) {
    this.yaw -= input.lookDX * 0.0052; this.pitch = THREE.MathUtils.clamp(this.pitch + input.lookDY * 0.004, -0.12, 1.3);
    this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(input.zoom), 2.4, 12);
    input.lookDX = input.lookDY = input.zoom = 0;

    // drift back behind the player while they walk (unless they just dragged the camera or are walking at it)
    if (heading !== null && now - input.lastLook > 1.4) {
      const behind = heading + Math.PI, diff = lerpAngle(0, behind - this.yaw, 1);
      if (Math.abs(diff) < 2.3) this.yaw += diff * Math.min(1, dt * 1.1);
    }
    if (this.first) { this.focus.copy(focus); this.first = false; } else this.focus.lerp(focus, Math.min(1, dt * 11));

    const cp = Math.cos(this.pitch);
    this.dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    // pull in if a wall, the ground or a roof sits between the player and the camera
    this.ray.set(this.focus, this.dir); this.ray.far = this.dist + 0.4;
    const hit = this.ray.intersectObjects(this.occluders, false)[0];
    const want = hit ? Math.max(0.9, hit.distance - 0.35) : this.dist;
    this.cur = want < this.cur ? want : this.cur + (want - this.cur) * Math.min(1, dt * 4);   // in: instantly, out: gently

    const shoulder = Math.min(0.45, this.cur * 0.07);    // slight over-the-shoulder offset
    this.camera.position.copy(this.focus).addScaledVector(this.dir, this.cur);
    this.camera.position.x += Math.cos(this.yaw) * shoulder; this.camera.position.z -= Math.sin(this.yaw) * shoulder;
    this.camera.lookAt(this.focus.x + Math.cos(this.yaw) * shoulder, this.focus.y, this.focus.z - Math.sin(this.yaw) * shoulder);
  }
}

// Move a character by (dx, dz). Returns true if they ended up somewhere new. `pos` is changed in place.
const RADIUS = 0.36;
export function tryMove(pos, dx, dz, world) {
  let nx = pos.x + dx, nz = pos.z + dz;
  for (let pass = 0; pass < 2; pass++) {                  // push out of columns, rails, trees…
    for (const c of world.colliders) {
      if (pos.y + 1.4 < c.y0 || pos.y > c.y1) continue;
      const ex = c.bx - c.ax, ez = c.bz - c.az, len2 = ex * ex + ez * ez;
      const u = len2 ? Math.max(0, Math.min(1, ((nx - c.ax) * ex + (nz - c.az) * ez) / len2)) : 0;
      const px = c.ax + ex * u, pz = c.az + ez * u, ox = nx - px, oz = nz - pz, d = Math.hypot(ox, oz), min = c.r + RADIUS;
      if (d < min && d > 1e-5) { nx = px + ox / d * min; nz = pz + oz / d * min; }
    }
  }
  // the ground decides: full move, else slide along one axis, else stay
  let gy = world.ground(nx, pos.y, nz);
  if (gy === null) {
    gy = world.ground(nx, pos.y, pos.z);
    if (gy !== null) nz = pos.z;
    else { gy = world.ground(pos.x, pos.y, nz); if (gy === null) return false; nx = pos.x; }
  }
  const moved = Math.abs(nx - pos.x) + Math.abs(nz - pos.z) > 1e-4;
  pos.x = nx; pos.y = gy; pos.z = nz;
  return moved;
}
