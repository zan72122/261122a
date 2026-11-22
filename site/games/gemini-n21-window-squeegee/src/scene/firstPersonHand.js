import * as THREE from 'three';

function createNaturalSkinTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ddb093');
  g.addColorStop(0.45, '#e8bfa5');
  g.addColorStop(0.85, '#e4b398');
  g.addColorStop(1, '#d8a58a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1.2 + Math.random() * 7;
    ctx.fillStyle = Math.random() > 0.48 ? 'rgba(205, 130, 108, 0.05)' : 'rgba(255, 236, 220, 0.045)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCottonKnitTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e7dfd3';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = (y % 8 === 0) ? 'rgba(175, 160, 140, 0.24)' : 'rgba(255, 250, 242, 0.16)';
    ctx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = 'rgba(160, 145, 128, 0.14)';
    ctx.fillRect(x, 0, 2, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  return tex;
}

/**
 * Anatomically foreshortened first-person right hand & dynamically aimed knit forearm sleeve.
 * The hand rotates naturally to grip any tool (vertical spray bottle, angled squeegee, or bare finger),
 * while the forearm ALWAYS anchors seamlessly from the wrist back to the viewer's right shoulder
 * in world space — guaranteeing zero awkward cross-screen swings and zero sill clipping!
 */
export class FirstPersonHand {
  constructor(scene, linenMat) {
    this.root = new THREE.Group();
    this.root.name = 'first_person_hand';
    this.root.visible = false;
    scene.add(this.root);

    // Separate world-space forearm group that bridges wrist -> viewer's right shoulder
    this.armWorldGroup = new THREE.Group();
    this.armWorldGroup.name = 'first_person_forearm';
    this.armWorldGroup.visible = false;
    scene.add(this.armWorldGroup);

    const skinTex = createNaturalSkinTexture();
    const knitTex = createCottonKnitTexture();

    this.skinMat = new THREE.MeshPhysicalMaterial({
      map: skinTex,
      color: new THREE.Color(0xf5ded0),
      roughness: 0.72,
      metalness: 0.0,
      sheen: 0.42,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(0xf2bda2),
      clearcoat: 0.01,
    });

    this.nailMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf2d7ca),
      roughness: 0.30,
      metalness: 0.0,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
    });

    this.sleeveMat = new THREE.MeshStandardMaterial({
      map: knitTex,
      normalMap: linenMat ? linenMat.normalMap : null,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.94,
      metalness: 0.0,
      color: new THREE.Color(0xf2eae0),
    });

    this.handPivot = new THREE.Group();
    this.root.add(this.handPivot);

    // --- Sculpted Anatomical Dorsal Palm ---
    const palmShape = new THREE.Shape();
    palmShape.moveTo(-0.023, 0.042);
    palmShape.quadraticCurveTo(-0.036, 0.014, -0.038, -0.026);
    palmShape.quadraticCurveTo(-0.034, -0.046, -0.011, -0.050);
    palmShape.quadraticCurveTo(0.019, -0.050, 0.033, -0.034);
    palmShape.quadraticCurveTo(0.035, 0.004, 0.023, 0.042);
    palmShape.closePath();

    const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
      depth: 0.013,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.007,
      bevelSegments: 5,
    });
    palmGeo.rotateX(Math.PI * 0.5);
    palmGeo.translate(0, 0.007, 0);
    const palm = new THREE.Mesh(palmGeo, this.skinMat);
    palm.castShadow = true;
    palm.receiveShadow = true;
    this.handPivot.add(palm);

    // Soft thumb heel pad
    const padGeo = new THREE.SphereGeometry(0.019, 12, 10);
    padGeo.scale(0.88, 0.72, 1.32);
    const thumbPad = new THREE.Mesh(padGeo, this.skinMat);
    thumbPad.position.set(-0.022, -0.006, 0.004);
    this.handPivot.add(thumbPad);

    // Wrist attachment anchor marker at base of palm (+Z)
    this.wristAnchor = new THREE.Object3D();
    this.wristAnchor.position.set(0.0, 0.0, 0.036);
    this.handPivot.add(this.wristAnchor);

    // --- World-Space Aimed Forearm & Softly Wrinkled Knit Sleeve (along +Z of armWorldGroup) ---
    // Bare wrist segment (0 -> 0.085m)
    const wristGeo = new THREE.CylinderGeometry(0.020, 0.023, 0.092, 16);
    wristGeo.rotateX(Math.PI * 0.5);
    wristGeo.scale(1.0, 0.84, 1.0);
    wristGeo.translate(0, 0, 0.044);
    const wristMesh = new THREE.Mesh(wristGeo, this.skinMat);
    wristMesh.castShadow = true;
    this.armWorldGroup.add(wristMesh);

    // Soft ribbed knit cuff collar at z = 0.088m
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.0055, 10, 20), this.sleeveMat);
    cuff.position.set(0, 0, 0.088);
    this.armWorldGroup.add(cuff);

    // Organically wrinkled knit forearm sleeve (z = 0.088m -> 0.82m)
    const sleeveLen = 0.76;
    const sleeveGeo = new THREE.CylinderGeometry(0.038, 0.026, sleeveLen, 20, 24, false);
    sleeveGeo.rotateX(Math.PI * 0.5);
    sleeveGeo.translate(0, 0, 0.088 + sleeveLen * 0.5);
    const sp = sleeveGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const z = sp.getZ(i);
      const t = (z - 0.088) / sleeveLen;
      const x = sp.getX(i);
      const y = sp.getY(i);
      const ang = Math.atan2(y, x);
      // Natural soft fabric drape & subtle knit folds
      const wrinkle = 1.0 + Math.sin(t * 28.0 + ang * 2.0) * 0.038 + Math.cos(t * 17.0 - ang * 3.0) * 0.024;
      sp.setXY(i, x * wrinkle, y * wrinkle);
    }
    sleeveGeo.computeVertexNormals();
    const sleeveMesh = new THREE.Mesh(sleeveGeo, this.sleeveMat);
    sleeveMesh.castShadow = true;
    this.armWorldGroup.add(sleeveMesh);

    // --- Articulated 3-Segment Tapered Fingers ---
    this.fingers = {};
    const fingerSpecs = [
      { name: 'index',  x: -0.025, z: -0.042, len: [0.031, 0.021, 0.016], r: 0.0076 },
      { name: 'middle', x: -0.008, z: -0.046, len: [0.034, 0.023, 0.017], r: 0.0079 },
      { name: 'ring',   x:  0.010, z: -0.042, len: [0.031, 0.021, 0.015], r: 0.0073 },
      { name: 'pinky',  x:  0.026, z: -0.033, len: [0.024, 0.016, 0.013], r: 0.0064 },
    ];

    for (const sp of fingerSpecs) {
      const base = new THREE.Group();
      base.position.set(sp.x, 0.002, sp.z);
      this.handPivot.add(base);

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r, sp.len[0] * 0.65, 5, 10), this.skinMat);
      seg1.rotation.x = Math.PI * 0.5;
      seg1.position.z = -sp.len[0] * 0.5;
      seg1.castShadow = true;
      base.add(seg1);

      const mid = new THREE.Group();
      mid.position.z = -sp.len[0];
      base.add(mid);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r * 0.88, sp.len[1] * 0.65, 5, 10), this.skinMat);
      seg2.rotation.x = Math.PI * 0.5;
      seg2.position.z = -sp.len[1] * 0.5;
      seg2.castShadow = true;
      mid.add(seg2);

      const tip = new THREE.Group();
      tip.position.z = -sp.len[1];
      mid.add(tip);

      const seg3 = new THREE.Mesh(new THREE.CapsuleGeometry(sp.r * 0.78, sp.len[2] * 0.55, 5, 10), this.skinMat);
      seg3.rotation.x = Math.PI * 0.5;
      seg3.position.z = -sp.len[2] * 0.45;
      seg3.castShadow = true;
      tip.add(seg3);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(sp.r * 0.58, 8, 6), this.nailMat);
      nail.scale.set(0.88, 0.22, 1.18);
      nail.position.set(0, sp.r * 0.62, -sp.len[2] * 0.58);
      tip.add(nail);

      this.fingers[sp.name] = { base, mid, tip };
    }

    const thumbBase = new THREE.Group();
    thumbBase.position.set(-0.034, -0.005, -0.004);
    this.handPivot.add(thumbBase);

    const tSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, 0.022, 5, 10), this.skinMat);
    tSeg1.rotation.x = Math.PI * 0.5;
    tSeg1.position.z = -0.015;
    tSeg1.castShadow = true;
    thumbBase.add(tSeg1);

    const thumbTip = new THREE.Group();
    thumbTip.position.z = -0.029;
    thumbBase.add(thumbTip);

    const tSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0076, 0.017, 5, 10), this.skinMat);
    tSeg2.rotation.x = Math.PI * 0.5;
    tSeg2.position.z = -0.012;
    tSeg2.castShadow = true;
    thumbTip.add(tSeg2);

    this.fingers.thumb = { base: thumbBase, tip: thumbTip };
    this._wristWorld = new THREE.Vector3();
    this._shoulderTarget = new THREE.Vector3(0.52, 0.48, 1.38);
  }

  setVisible(vis) {
    this.root.visible = vis;
    this.armWorldGroup.visible = vis;
  }

  /** Align forearm cleanly from wrist to viewer's right shoulder in world space */
  alignForearmToShoulder() {
    this.root.updateMatrixWorld(true);
    this.wristAnchor.getWorldPosition(this._wristWorld);
    this.armWorldGroup.position.copy(this._wristWorld);
    // Keep forearm comfortably angled back-right & slightly down toward viewer's right shoulder
    this._shoulderTarget.set(
      Math.max(0.42, this._wristWorld.x + 0.34),
      Math.min(0.68, this._wristWorld.y - 0.32),
      1.35
    );
    this.armWorldGroup.lookAt(this._shoulderTarget);
  }

  setPose(mode, squeeze = 0) {
    const f = this.fingers;
    if (mode === 'spray') {
      const pull = 0.52 + squeeze * 0.52;
      f.index.base.rotation.set(-pull * 0.72, 0.08, 0);
      f.index.mid.rotation.x = -pull * 0.88;
      f.index.tip.rotation.x = -pull * 0.55;

      f.middle.base.rotation.set(-pull * 0.68, 0.04, 0);
      f.middle.mid.rotation.x = -pull * 0.84;
      f.middle.tip.rotation.x = -pull * 0.52;

      for (const n of ['ring', 'pinky']) {
        f[n].base.rotation.set(-1.08, 0, 0);
        f[n].mid.rotation.x = -1.18;
        f[n].tip.rotation.x = -0.68;
      }
      f.thumb.base.rotation.set(-0.28, -0.45, 0.35);
      f.thumb.tip.rotation.set(-0.32, 0, 0);
    } else if (mode === 'squeegee') {
      const curls = { index: 0.92, middle: 1.08, ring: 1.15, pinky: 1.22 };
      for (const [n, c] of Object.entries(curls)) {
        f[n].base.rotation.set(-c, 0, 0);
        f[n].mid.rotation.x = -1.12;
        f[n].tip.rotation.x = -0.72;
      }
      f.thumb.base.rotation.set(-0.26, -0.52, 0.42);
      f.thumb.tip.rotation.set(-0.34, 0, 0);
    } else if (mode === 'finger') {
      f.index.base.rotation.set(-0.08, 0.04, 0);
      f.index.mid.rotation.x = -0.10;
      f.index.tip.rotation.x = -0.06;
      for (const n of ['middle', 'ring', 'pinky']) {
        f[n].base.rotation.set(-1.32, 0, 0);
        f[n].mid.rotation.x = -1.30;
        f[n].tip.rotation.x = -0.80;
      }
      f.thumb.base.rotation.set(-0.52, -0.58, 0.45);
      f.thumb.tip.rotation.set(-0.42, 0, 0);
    }
  }
}

export class SprayParticles {
  constructor(scene) {
    this.maxCount = 120;
    this.particles = [];

    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.45, 'rgba(235, 248, 255, 0.55)');
    g.addColorStop(1, 'rgba(235, 248, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);

    this.positions = new Float32Array(this.maxCount * 3);
    for (let i = 0; i < this.maxCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.3,
        gravity: 0.8,
      });
      this.positions[i * 3 + 1] = -100;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo = geo;

    this.mat = new THREE.PointsMaterial({
      map: tex,
      color: new THREE.Color(0xf6fcff),
      size: 0.034,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this._cursor = 0;
  }

  emitSprayBurst(originWorld, targetWorld) {
    const dir = new THREE.Vector3().subVectors(targetWorld, originWorld);
    const dist = Math.max(0.08, dir.length());
    dir.normalize();

    for (let i = 0; i < 28; i++) {
      const p = this.particles[this._cursor];
      this._cursor = (this._cursor + 1) % this.maxCount;
      p.active = true;
      p.pos.copy(originWorld);
      const spread = 0.24;
      const speed = (dist / 0.14) * (0.78 + Math.random() * 0.45);
      p.vel.set(
        dir.x * speed + (Math.random() - 0.5) * spread * speed,
        dir.y * speed + (Math.random() - 0.5) * spread * speed + 0.06,
        dir.z * speed + (Math.random() - 0.5) * spread * 0.3
      );
      p.maxLife = 0.14 + Math.random() * 0.12;
      p.life = p.maxLife;
      p.gravity = 0.65;
    }
  }

  emitSparkleDrops(worldPos, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this._cursor];
      this._cursor = (this._cursor + 1) % this.maxCount;
      p.active = true;
      p.pos.copy(worldPos);
      p.vel.set(
        (Math.random() - 0.5) * 0.28,
        0.08 + Math.random() * 0.22,
        0.05 + Math.random() * 0.15
      );
      p.maxLife = 0.35 + Math.random() * 0.28;
      p.life = p.maxLife;
      p.gravity = 1.6;
    }
  }

  update(dt) {
    let anyActive = false;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0 || p.pos.z < 0.008) {
        p.active = false;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      this.positions[i * 3] = p.pos.x;
      this.positions[i * 3 + 1] = p.pos.y;
      this.positions[i * 3 + 2] = p.pos.z;
      anyActive = true;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.points.visible = anyActive;
  }
}
