import * as THREE from '../lib/three.module.js';

const MAX_PARTICLES = 720;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Single-draw-call InstancedMesh voxel particle pool for water cubes,
 * dirt clods, bubbles, sparkle stars, dressing droplets, and confetti.
 */
export class VoxelParticles {
  constructor(scene, blockTex) {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: blockTex,
      roughness: 0.32,
      metalness: 0.04,
    });
    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;

    this.items = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.items.push({
        active: false,
        x: 0, y: -100, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0, vrz: 0,
        size: 0.1,
        life: 0,
        maxLife: 1,
        gravity: -14,
        floorY: 0,
        bounce: 0.35,
        bouncesLeft: 1,
        kind: 'water',
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.cursor = 0;

    scene.add(this.mesh);
  }

  spawn(opts) {
    // Find free or oldest slot via ring cursor
    let p = null;
    for (let tries = 0; tries < 24; tries++) {
      const idx = (this.cursor + tries) % MAX_PARTICLES;
      if (!this.items[idx].active) {
        p = this.items[idx];
        this.cursor = (idx + 1) % MAX_PARTICLES;
        this._initParticle(idx, p, opts);
        return;
      }
    }
    const idx = this.cursor;
    this.cursor = (idx + 1) % MAX_PARTICLES;
    this._initParticle(idx, this.items[idx], opts);
  }

  _initParticle(idx, p, opts) {
    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.z = opts.z;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.rx = Math.random() * Math.PI;
    p.ry = Math.random() * Math.PI;
    p.rz = Math.random() * Math.PI;
    p.vrx = (Math.random() - 0.5) * 8;
    p.vry = (Math.random() - 0.5) * 8;
    p.vrz = (Math.random() - 0.5) * 8;
    p.size = opts.size ?? 0.12;
    p.life = 0;
    p.maxLife = opts.maxLife ?? 0.9;
    p.gravity = opts.gravity ?? -15;
    p.floorY = opts.floorY ?? 0.05;
    p.bounce = opts.bounce ?? 0.32;
    p.bouncesLeft = opts.bouncesLeft ?? 1;
    p.kind = opts.kind ?? 'water';

    _color.setHex(opts.color ?? 0x4fd2ff);
    this.mesh.setColorAt(idx, _color);
    this.mesh.instanceColor.needsUpdate = true;
  }

  emitWaterSplash(x, y, z, count = 10, floorY = 0.05, spread = 2.4) {
    const colors = [0x4fd2ff, 0x7ae2ff, 0xc7f4ff, 0x38bdf8];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.9) * spread;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.25,
        y: y + Math.random() * 0.15,
        z: z + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(a) * spd,
        vy: 1.8 + Math.random() * 3.0,
        vz: Math.sin(a) * spd,
        size: 0.09 + Math.random() * 0.08,
        maxLife: 0.45 + Math.random() * 0.35,
        gravity: -16,
        floorY,
        bounce: 0.28,
        bouncesLeft: 1,
        color: colors[i % colors.length],
        kind: 'water',
      });
    }
  }

  emitDirtBurst(x, y, z, count = 14, floorY = 0.05) {
    const colors = [0x6e472b, 0x8a5b38, 0x52341f, 0xa16f45];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 2.2;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + Math.random() * 0.2,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(a) * spd,
        vy: 2.2 + Math.random() * 3.2,
        vz: Math.sin(a) * spd,
        size: 0.08 + Math.random() * 0.08,
        maxLife: 0.55 + Math.random() * 0.35,
        gravity: -18,
        floorY,
        bounce: 0.25,
        bouncesLeft: 1,
        color: colors[i % colors.length],
        kind: 'dirt',
      });
    }
  }

  emitBubbles(x, y, z, count = 8) {
    const colors = [0xe8fbff, 0xc9f3ff, 0xffffff, 0xb8ecff];
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.8,
        y: y + Math.random() * 0.25,
        z: z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 0.7,
        vy: 1.0 + Math.random() * 1.4,
        vz: (Math.random() - 0.5) * 0.7,
        size: 0.11 + Math.random() * 0.11,
        maxLife: 0.7 + Math.random() * 0.6,
        gravity: 0.8,
        floorY: -10,
        bouncesLeft: 0,
        color: colors[i % colors.length],
        kind: 'bubble',
      });
    }
  }

  emitSparkles(x, y, z, count = 12, palette = [0xffe066, 0xffffff, 0xfff3a8, 0x7ef7d4]) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.8;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.45,
        y: y + (Math.random() - 0.5) * 0.3,
        z: z + (Math.random() - 0.5) * 0.45,
        vx: Math.cos(a) * spd,
        vy: 1.4 + Math.random() * 2.2,
        vz: Math.sin(a) * spd,
        size: 0.09 + Math.random() * 0.08,
        maxLife: 0.55 + Math.random() * 0.4,
        gravity: -2.5,
        floorY: -10,
        bouncesLeft: 0,
        color: palette[i % palette.length],
        kind: 'sparkle',
      });
    }
  }

  emitConfetti(x, y, z, count = 42) {
    const palette = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0xff8fab, 0xfff3b0];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 3.4;
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.2,
        y: y + Math.random() * 0.6,
        z: z + (Math.random() - 0.5) * 1.2,
        vx: Math.cos(a) * spd,
        vy: 3.4 + Math.random() * 3.8,
        vz: Math.sin(a) * spd,
        size: 0.12 + Math.random() * 0.08,
        maxLife: 1.6 + Math.random() * 0.9,
        gravity: -5.2,
        floorY: 0.08,
        bounce: 0.35,
        bouncesLeft: 1,
        color: palette[i % palette.length],
        kind: 'confetti',
      });
    }
  }

  update(dt) {
    let anyDirty = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      anyDirty = true;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.vy += p.gravity * dt;
      if (p.kind === 'bubble') {
        p.vx += Math.sin(p.life * 8 + i) * 0.6 * dt;
      }
      if (p.kind === 'confetti') {
        p.vx *= 1 - 1.2 * dt;
        p.vz *= 1 - 1.2 * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      if (p.y < p.floorY && p.vy < 0) {
        p.y = p.floorY;
        if (p.bouncesLeft > 0) {
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.65;
          p.vz *= 0.65;
          p.bouncesLeft--;
        } else {
          p.vy = 0;
          p.vx *= 0.5;
          p.vz *= 0.5;
        }
      }

      p.rx += p.vrx * dt;
      p.ry += p.vry * dt;
      p.rz += p.vrz * dt;

      const t = p.life / p.maxLife;
      let scale = p.size;
      if (t > 0.72) {
        scale *= 1 - (t - 0.72) / 0.28;
      } else if (t < 0.08) {
        scale *= t / 0.08;
      }

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rx, p.ry, p.rz);
      if (p.kind === 'confetti') {
        _dummy.scale.set(scale * 1.4, scale * 0.35, scale * 1.1);
      } else {
        _dummy.scale.set(scale, scale, scale);
      }
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyDirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
