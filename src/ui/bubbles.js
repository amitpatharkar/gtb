import * as THREE from 'three';

// Short speech bubbles over people and cars ("Ae! Ruko!", "₹1,000 challan!"), placed in
// screen space each frame. Only near the camera, a handful at a time.

export class Bubbles {
  constructor(parent = document.body) {
    this.layer = document.createElement('div');
    this.layer.id = 'bubbles';
    parent.appendChild(this.layer);
    this.list = [];
    this.v = new THREE.Vector3();
  }

  /** anchor: { x, y, z } object (followed while the bubble lives) or a fixed point. */
  say(anchor, text, ttl = 2.8, kind = '') {
    // One bubble per anchor: replace what it was saying.
    const old = this.list.find((b) => b.anchor === anchor);
    if (old) { old.el.textContent = text; old.ttl = ttl; old.age = 0; return; }
    if (this.list.length > 8) this.remove(this.list[0]);
    const el = document.createElement('div');
    el.className = `bubble ${kind}`;
    el.textContent = text;
    this.layer.appendChild(el);
    this.list.push({ anchor, el, ttl, age: 0, h: anchor.h ?? 2.2 });
  }

  remove(b) {
    b.el.remove();
    this.list.splice(this.list.indexOf(b), 1);
  }

  update(dt, camera) {
    const w = innerWidth, h = innerHeight;
    for (const b of [...this.list]) {
      b.age += dt;
      if (b.age > b.ttl) { this.remove(b); continue; }
      this.v.set(b.anchor.x, (b.anchor.y || 0) + b.h, b.anchor.z);
      const dist = this.v.distanceTo(camera.position);
      this.v.project(camera);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1 && dist < 140;
      b.el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const s = THREE.MathUtils.clamp(26 / dist, 0.55, 1.15);
      b.el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%) scale(${s})`;
      b.el.style.opacity = String(Math.min(1, (b.ttl - b.age) * 3, b.age * 8));
    }
  }
}
