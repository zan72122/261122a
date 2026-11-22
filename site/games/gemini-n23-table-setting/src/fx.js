import * as THREE from 'three';
import { createComicSpriteTexture } from './toon.js';

export class ComicFX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.textures = {
      star: createComicSpriteTexture('star'),
      heart: createComicSpriteTexture('heart'),
      note: createComicSpriteTexture('note'),
      steam: createComicSpriteTexture('steam'),
      droplet: createComicSpriteTexture('droplet'),
      burst: createComicSpriteTexture('burst'),
      hand: createComicSpriteTexture('hand'),
    };

    // Rare idle hand demo sprite (starts invisible; only shown after 10s idle once)
    const handMat = new THREE.SpriteMaterial({
      map: this.textures.hand,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.handSprite = new THREE.Sprite(handMat);
    this.handSprite.renderOrder = 999;
    this.handSprite.scale.set(0.65, 0.65, 1);
    this.handSprite.visible = false;
    this.scene.add(this.handSprite);

    this.handAnim = null;
  }

  spawnSprite(kind, pos, opts = {}) {
    const mat = new THREE.SpriteMaterial({
      map: this.textures[kind] || this.textures.star,
      transparent: true,
      opacity: opts.opacity !== undefined ? opts.opacity : 1,
      color: opts.color !== undefined ? opts.color : 0xffffff,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    const s = opts.scale || 0.35;
    sp.scale.set(s, s, 1);
    this.scene.add(sp);

    this.particles.push({
      sprite: sp,
      vx: opts.vx || 0,
      vy: opts.vy !== undefined ? opts.vy : 0.8,
      vz: opts.vz || 0,
      gravity: opts.gravity || 0,
      age: 0,
      life: opts.life || 0.9,
      baseScale: s,
      grow: opts.grow !== undefined ? opts.grow : 0.35,
      wobble: opts.wobble || 0,
      wobbleFreq: opts.wobbleFreq || 5,
      spin: opts.spin || 0,
      fadeOut: opts.fadeOut !== false,
    });
    return sp;
  }

  spawnBurst(pos, count = 6, kind = 'star', spread = 1.2) {
    // Central quick comic impact pop
    this.spawnSprite('burst', pos.clone().add(new THREE.Vector3(0, 0.15, 0)), {
      scale: 0.55,
      vy: 0.25,
      life: 0.32,
      grow: 0.7,
    });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = spread * (0.65 + Math.random() * 0.55);
      this.spawnSprite(kind, pos.clone().add(new THREE.Vector3(0, 0.12, 0)), {
        vx: Math.cos(a) * spd,
        vy: 1.1 + Math.random() * 0.9,
        vz: Math.sin(a) * spd,
        gravity: 2.2,
        scale: 0.26 + Math.random() * 0.16,
        life: 0.65 + Math.random() * 0.3,
        grow: 0.1,
      });
    }
  }

  spawnSteam(pos, scale = 0.42) {
    this.spawnSprite('steam', pos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      0,
      (Math.random() - 0.5) * 0.35
    )), {
      vx: (Math.random() - 0.5) * 0.15,
      vy: 0.65 + Math.random() * 0.35,
      vz: (Math.random() - 0.5) * 0.15,
      scale,
      life: 1.25 + Math.random() * 0.4,
      grow: 0.55,
      wobble: 0.22,
      wobbleFreq: 4.5,
      opacity: 0.85,
    });
  }

  spawnSplash(pos, color = 0xffca4b, count = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.7 + Math.random() * 1.1;
      this.spawnSprite('droplet', pos.clone(), {
        color,
        vx: Math.cos(a) * spd,
        vy: 1.4 + Math.random() * 0.9,
        vz: Math.sin(a) * spd,
        gravity: 5.2,
        scale: 0.16 + Math.random() * 0.1,
        life: 0.5 + Math.random() * 0.2,
        grow: -0.2,
      });
    }
  }

  spawnEmote(pos, kind = 'heart') {
    this.spawnSprite(kind, pos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      0.1,
      0.1
    )), {
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.85 + Math.random() * 0.3,
      scale: 0.36 + Math.random() * 0.12,
      life: 1.1,
      grow: 0.25,
      wobble: 0.18,
      wobbleFreq: 6,
    });
  }

  spawnSprinkle(pos) {
    const colors = [0x44c767, 0xffe047, 0xff7052, 0xffffff];
    for (let i = 0; i < 4; i++) {
      this.spawnSprite('star', pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.22,
        0,
        (Math.random() - 0.5) * 0.22
      )), {
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.6 - Math.random() * 0.4,
        vz: (Math.random() - 0.5) * 0.35,
        gravity: 2.5,
        scale: 0.13 + Math.random() * 0.06,
        life: 0.42,
        grow: -0.2,
      });
    }
  }

  playIdleHandDemo(fromPos, toPos) {
    this.handAnim = {
      from: fromPos.clone(),
      to: toPos.clone(),
      age: 0,
      duration: 2.1,
    };
    this.handSprite.visible = true;
  }

  cancelIdleHandDemo() {
    this.handAnim = null;
    this.handSprite.visible = false;
    this.handSprite.material.opacity = 0;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt + (p.wobble ? Math.sin(p.age * p.wobbleFreq) * p.wobble * dt : 0);
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;

      const s = p.baseScale * (1 + p.grow * t) * (t < 0.15 ? t / 0.15 : 1);
      p.sprite.scale.set(Math.max(0.01, s), Math.max(0.01, s), 1);

      if (p.fadeOut && t > 0.55) {
        p.sprite.material.opacity = Math.max(0, 1 - (t - 0.55) / 0.45);
      }
    }

    if (this.handAnim) {
      this.handAnim.age += dt;
      const u = this.handAnim.age / this.handAnim.duration;
      if (u >= 1) {
        this.cancelIdleHandDemo();
      } else {
        // Fade in (0-0.18), glide (0.18-0.78), fade out (0.78-1)
        let alpha = 0.92;
        if (u < 0.18) alpha = (u / 0.18) * 0.92;
        else if (u > 0.78) alpha = ((1 - u) / 0.22) * 0.92;
        this.handSprite.material.opacity = alpha;

        const moveT = THREE.MathUtils.clamp((u - 0.15) / 0.65, 0, 1);
        const ease = moveT * moveT * (3 - 2 * moveT);
        this.handSprite.position.lerpVectors(this.handAnim.from, this.handAnim.to, ease);
        this.handSprite.position.y += Math.sin(ease * Math.PI) * 0.45;
      }
    }
  }
}
