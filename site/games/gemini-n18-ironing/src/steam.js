import * as THREE from 'three';

/**
 * Photorealistic sunlit steam plumes & fine glass-bottle water mist particles.
 * Uses soft multi-lobe cloud puff sprites with warm morning backlighting and
 * swirling upward buoyancy (zero hard circles, zero glowing cartoon stars!).
 */
export function createSteamSystem(scene) {
  // Generate an authentic soft organic cloud-wisp alpha texture (256x256)
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Layer 7 slightly offset soft radial lobes for wispy volumetric-looking steam
  const lobes = [
    [128, 128, 96, 0.42],
    [102, 118, 72, 0.30],
    [152, 122, 68, 0.28],
    [124, 100, 62, 0.24],
    [134, 152, 66, 0.25],
    [94, 144, 52, 0.20],
    [158, 146, 54, 0.18],
  ];
  for (const [cx, cy, r, a] of lobes) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    g.addColorStop(0, `rgba(255, 253, 248, ${a})`);
    g.addColorStop(0.5, `rgba(248, 247, 244, ${a * 0.45})`);
    g.addColorStop(1, 'rgba(245, 245, 245, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const steamTex = new THREE.CanvasTexture(canvas);
  steamTex.colorSpace = THREE.SRGBColorSpace;

  // Fine water droplet sprite for spray bottle mist
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 64;
  mistCanvas.height = 64;
  const mctx = mistCanvas.getContext('2d');
  const mg = mctx.createRadialGradient(32, 32, 2, 32, 32, 28);
  mg.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  mg.addColorStop(0.35, 'rgba(232, 244, 252, 0.55)');
  mg.addColorStop(1, 'rgba(232, 244, 252, 0)');
  mctx.fillStyle = mg;
  mctx.fillRect(0, 0, 64, 64);
  const mistTex = new THREE.CanvasTexture(mistCanvas);
  mistTex.colorSpace = THREE.SRGBColorSpace;

  // Steam puff pool (Sprite-based for camera-facing billow + rotation + zero Z-fighting)
  const MAX_STEAM = 95;
  const steamPool = [];
  const steamGroup = new THREE.Group();
  scene.add(steamGroup);

  for (let i = 0; i < MAX_STEAM; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      color: new THREE.Color('#fffcf6'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    steamGroup.add(sprite);
    steamPool.push({
      sprite,
      mat,
      active: false,
      age: 0,
      life: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      startScale: 0.05,
      endScale: 0.25,
      peakOpacity: 0.35,
      curlPhase: Math.random() * Math.PI * 2,
    });
  }

  // Mist droplet pool
  const MAX_MIST = 70;
  const mistPool = [];
  for (let i = 0; i < MAX_MIST; i++) {
    const mat = new THREE.SpriteMaterial({
      map: mistTex,
      color: new THREE.Color('#eef7ff'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    steamGroup.add(sprite);
    mistPool.push({
      sprite,
      mat,
      active: false,
      age: 0,
      life: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.015,
    });
  }

  let steamCursor = 0;
  let mistCursor = 0;

  function emitSteam(x, y, z, opts = {}) {
    const p = steamPool[steamCursor];
    steamCursor = (steamCursor + 1) % MAX_STEAM;
    p.active = true;
    p.age = 0;
    p.life = opts.life ?? (0.85 + Math.random() * 0.75);
    p.sprite.position.set(
      x + (Math.random() - 0.5) * (opts.spread ?? 0.05),
      y + Math.random() * 0.01,
      z + (Math.random() - 0.5) * (opts.spread ?? 0.05)
    );
    p.vx = (opts.vx ?? 0) + (Math.random() - 0.5) * 0.06;
    p.vy = (opts.vy ?? 0.16) + Math.random() * 0.11;
    p.vz = (opts.vz ?? 0) + (Math.random() - 0.5) * 0.05;
    p.startScale = opts.startScale ?? (0.045 + Math.random() * 0.025);
    p.endScale = opts.endScale ?? (0.20 + Math.random() * 0.14);
    p.peakOpacity = opts.opacity ?? (0.24 + Math.random() * 0.14);
    p.spin = (Math.random() - 0.5) * 1.1;
    p.mat.rotation = Math.random() * Math.PI * 2;
    p.sprite.scale.setScalar(p.startScale);
    p.sprite.visible = true;
  }

  /**
   * Emits a dramatic sideways & upward steam puff from around the iron's soleplate perimeter.
   */
  function emitIronBurst(ironPos, intensity = 1.0, count = 8) {
    for (let i = 0; i < count; i++) {
      // Bias billowing sunlit steam around the front/left soleplate vents (clear of the hand!)
      const ang = Math.PI * 0.45 + (i / count) * Math.PI * 1.45 + Math.random() * 0.35;
      const rad = 0.048 + Math.random() * 0.04;
      emitSteam(
        ironPos.x - 0.035 + Math.cos(ang) * rad,
        ironPos.y + 0.015,
        ironPos.z + Math.sin(ang) * rad,
        {
          vx: -0.05 + Math.cos(ang) * (0.09 + 0.08 * intensity),
          vy: 0.17 + 0.12 * intensity,
          vz: Math.sin(ang) * (0.08 + 0.08 * intensity),
          life: 0.95 + 0.55 * intensity,
          startScale: 0.05,
          endScale: 0.24 + 0.14 * intensity,
          opacity: Math.min(0.56, 0.30 + 0.16 * intensity),
          spread: 0.025,
        }
      );
    }
  }

  /**
   * Sprays sparkling fine water mist cone from nozzle toward target point on the cloth.
   */
  function emitWaterMist(origin, target, count = 26) {
    const dir = new THREE.Vector3().subVectors(target, origin);
    const dist = dir.length();
    dir.normalize();

    for (let i = 0; i < count; i++) {
      const p = mistPool[mistCursor];
      mistCursor = (mistCursor + 1) % MAX_MIST;
      p.active = true;
      p.age = 0;
      p.life = 0.28 + Math.random() * 0.22;
      p.sprite.position.copy(origin);
      const speed = (dist / 0.26) * (0.78 + Math.random() * 0.45);
      p.vx = dir.x * speed + (Math.random() - 0.5) * 0.28;
      p.vy = dir.y * speed + 0.14 + (Math.random() - 0.5) * 0.22;
      p.vz = dir.z * speed + (Math.random() - 0.5) * 0.28;
      p.scale = 0.010 + Math.random() * 0.014;
      p.sprite.scale.setScalar(p.scale);
      p.sprite.visible = true;
    }

    // Add 3 delicate mist-cloud wisps right in front of the nozzle
    for (let i = 0; i < 3; i++) {
      emitSteam(
        origin.x + dir.x * 0.08,
        origin.y + dir.y * 0.08,
        origin.z + dir.z * 0.08,
        {
          vx: dir.x * 0.32,
          vy: dir.y * 0.18 + 0.05,
          vz: dir.z * 0.32,
          life: 0.42,
          startScale: 0.03,
          endScale: 0.14,
          opacity: 0.18,
          spread: 0.03,
        }
      );
    }
  }

  function update(dt, time) {
    for (let i = 0; i < MAX_STEAM; i++) {
      const p = steamPool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      // Air drag slows sideways motion while buoyancy lifts & curls lazily into the window breeze
      p.vx *= Math.max(0, 1 - dt * 2.1);
      p.vz *= Math.max(0, 1 - dt * 2.1);
      p.vy = THREE.MathUtils.lerp(p.vy, 0.18, dt * 1.4);

      const curl = Math.sin(time * 2.2 + p.curlPhase + t * 3.0) * 0.035;
      p.sprite.position.x += (p.vx + curl + 0.025) * dt; // Slight warm window draft rightward
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += (p.vz + Math.cos(time * 1.8 + p.curlPhase) * 0.025) * dt;

      const s = THREE.MathUtils.lerp(p.startScale, p.endScale, Math.pow(t, 0.65));
      p.sprite.scale.setScalar(s);
      p.mat.rotation += p.spin * dt;

      // Quick organic bloom-in, silky fade-out
      const env = t < 0.18 ? t / 0.18 : Math.pow(1 - (t - 0.18) / 0.82, 1.55);
      p.mat.opacity = p.peakOpacity * env;
    }

    for (let i = 0; i < MAX_MIST; i++) {
      const p = mistPool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.vy -= 1.2 * dt; // Fine droplet gravity
      p.vx *= Math.max(0, 1 - dt * 3.5);
      p.vz *= Math.max(0, 1 - dt * 3.5);
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.scale.setScalar(p.scale * (1 + t * 0.9));
      p.mat.opacity = (1 - t) * 0.62;
    }
  }

  return {
    emitSteam,
    emitIronBurst,
    emitWaterMist,
    update,
  };
}
