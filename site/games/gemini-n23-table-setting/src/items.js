import * as THREE from 'three';
import {
  INK_COLOR,
  createToonMesh,
  createToonMaterial,
  createPlateTexture,
} from './toon.js';

export const DINNER_MENUS = [
  {
    id: 'curry',
    brothColor: 0xc8741e,
    brothHighlight: 0xe39434,
    chunkColors: [0xff6d2e, 0xffe49e, 0x3eb354, 0x7c3e26], // carrot, potato, broccoli, meatball
    chunkKinds: ['carrot', 'potato', 'broccoli', 'meatball'],
  },
  {
    id: 'stew',
    brothColor: 0xfff0d4,
    brothHighlight: 0xffffff,
    chunkColors: [0xff7d6b, 0xffd53d, 0x43bf64, 0xe84a5f], // salmon, corn, broccoli, cherry tomato
    chunkKinds: ['salmon', 'corn', 'broccoli', 'tomato'],
  },
  {
    id: 'nabe',
    brothColor: 0xe5aa4c,
    brothHighlight: 0xf7cf7c,
    chunkColors: [0xff8fb1, 0xfffbf0, 0x3da854, 0xff7b2e], // narutomaki, tofu, greens, carrot star
    chunkKinds: ['naruto', 'tofu', 'broccoli', 'carrot'],
  },
];

function createChunkMesh(kind, colorHex, scale = 1) {
  let geo;
  if (kind === 'carrot' || kind === 'naruto') {
    geo = new THREE.CylinderGeometry(0.065 * scale, 0.065 * scale, 0.036 * scale, 7);
  } else if (kind === 'tofu' || kind === 'salmon') {
    geo = new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.1 * scale);
  } else if (kind === 'broccoli') {
    geo = new THREE.DodecahedronGeometry(0.068 * scale, 0);
  } else {
    geo = new THREE.SphereGeometry(0.062 * scale, 8, 7);
  }
  return createToonMesh(geo, colorHex, { outline: 0.014 * scale });
}

// ---------- PLATE / BOWL ----------
export class DinnerPlate {
  constructor(idx, cfg, homePos, scene) {
    this.idx = idx;
    this.role = cfg.role;
    this.accentColor = cfg.accentColor;
    this.homePos = homePos.clone();
    this.seat = null;
    this.stackedOn = null;
    this.foodLevel = 0; // 0..3 (1=normal, 2=generous, 3=mountain!)
    this.bitesLeft = 0;
    this.eatenCount = 0;
    this.sprinkled = false;
    this.menuIndex = 0;
    this.isDragging = false;
    this.bounce = 0;
    this.wobble = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.homePos);
    scene.add(this.group);

    // Sculpted ceramic shallow bowl using LatheGeometry!
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.24, 0.0),
      new THREE.Vector2(0.37, 0.065),
      new THREE.Vector2(0.42, 0.115),
      new THREE.Vector2(0.39, 0.12),
      new THREE.Vector2(0.29, 0.055),
      new THREE.Vector2(0.0, 0.045),
    ];
    const plateGeo = new THREE.LatheGeometry(pts, 24);
    this.dishMesh = createToonMesh(plateGeo, 0xfffaf0, { outline: 0.024 });
    this.group.add(this.dishMesh);

    // Vivid colored comic rim collar so each plate's color pops clearly even when stacked!
    const rimTorus = createToonMesh(
      new THREE.TorusGeometry(0.402, 0.024, 8, 24),
      cfg.accentColor,
      { outline: 0.012, castShadow: false }
    );
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = 0.115;
    this.group.add(rimTorus);

    // Patterned top disc clearly visible inside the rim!
    const plateTex = createPlateTexture(cfg.accentHex, cfg.motif);
    const topDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.382, 24),
      createToonMaterial(0xffffff, { map: plateTex, steps: 2 })
    );
    topDisc.rotation.x = -Math.PI / 2;
    topDisc.position.y = 0.105;
    this.group.add(topDisc);

    // Food mound container (grows visibly with scoops 1 -> 2 -> 3!)
    this.foodGroup = new THREE.Group();
    this.foodGroup.position.y = 0.108;
    this.foodGroup.visible = false;
    this.group.add(this.foodGroup);

    this.brothMesh = createToonMesh(
      new THREE.SphereGeometry(0.31, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      DINNER_MENUS[0].brothColor,
      { outline: 0.018 }
    );
    this.brothMesh.scale.set(1, 0.45, 1);
    this.foodGroup.add(this.brothMesh);

    this.chunkGroup = new THREE.Group();
    this.foodGroup.add(this.chunkGroup);

    this.sprinkleGroup = new THREE.Group();
    this.foodGroup.add(this.sprinkleGroup);

    // Generous invisible touch collider
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.47, 0.24, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.1;
    hit.userData.interactKind = 'plate';
    hit.userData.item = this;
    this.group.add(hit);
    this.hitMesh = hit;
  }

  addFood(menuIndex) {
    this.menuIndex = menuIndex;
    const menu = DINNER_MENUS[menuIndex];
    this.foodLevel = Math.min(3, this.foodLevel + 1);
    this.bitesLeft = Math.min(9, this.bitesLeft + 3);
    this.foodGroup.visible = true;
    this.brothMesh.material.color.setHex(menu.brothColor);
    this.bounce = 1.0;

    // Height grows dramatically for comical anime mountain servings!
    const hScale = this.foodLevel === 1 ? 0.55 : this.foodLevel === 2 ? 0.95 : 1.48;
    const rScale = this.foodLevel === 1 ? 0.92 : this.foodLevel === 2 ? 1.02 : 1.08;
    this.brothMesh.scale.set(rScale, hScale, rScale);

    // Add 4 chunky colorful veggies/toppings at this level!
    const baseY = this.foodLevel === 1 ? 0.1 : this.foodLevel === 2 ? 0.21 : 0.34;
    const spread = this.foodLevel === 3 ? 0.14 : 0.2;
    for (let i = 0; i < 4; i++) {
      const ci = (i + this.foodLevel) % menu.chunkKinds.length;
      const chunk = createChunkMesh(menu.chunkKinds[ci], menu.chunkColors[ci], 1.05);
      const a = (i / 4) * Math.PI * 2 + this.foodLevel * 0.7;
      chunk.position.set(
        Math.cos(a) * spread * (0.6 + Math.random() * 0.5),
        baseY + Math.random() * 0.05,
        Math.sin(a) * spread * (0.6 + Math.random() * 0.5)
      );
      chunk.rotation.set(Math.random() * 0.8, Math.random() * Math.PI, Math.random() * 0.8);
      this.chunkGroup.add(chunk);
    }
  }

  addSprinkles() {
    if (this.foodLevel <= 0) return false;
    this.sprinkled = true;
    this.bounce = 0.6;
    const colors = [0x3bc962, 0xffe14d, 0xff6b52, 0xffffff];
    const topY = this.foodLevel === 1 ? 0.16 : this.foodLevel === 2 ? 0.29 : 0.44;
    for (let i = 0; i < 8; i++) {
      const bit = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.018, 0.036),
        createToonMaterial(colors[i % colors.length], { steps: 2 })
      );
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.22;
      bit.position.set(Math.cos(a) * r, topY + Math.random() * 0.04, Math.sin(a) * r);
      bit.rotation.set(Math.random(), Math.random(), Math.random());
      this.sprinkleGroup.add(bit);
    }
    return true;
  }

  consumeBite() {
    if (this.bitesLeft <= 0) return;
    this.bitesLeft--;
    this.bounce = 0.5;
    // Remove a couple visual chunks per bite
    for (let k = 0; k < 2 && this.chunkGroup.children.length > 0; k++) {
      this.chunkGroup.remove(this.chunkGroup.children[this.chunkGroup.children.length - 1]);
    }
    if (this.bitesLeft <= 0) {
      this.clearFood();
      this.eatenCount++;
    } else {
      const newLevel = Math.ceil(this.bitesLeft / 3);
      this.foodLevel = newLevel;
      const hScale = newLevel === 1 ? 0.5 : newLevel === 2 ? 0.88 : 1.35;
      this.brothMesh.scale.set(0.95, hScale, 0.95);
    }
  }

  clearFood() {
    this.foodLevel = 0;
    this.bitesLeft = 0;
    this.sprinkled = false;
    this.foodGroup.visible = false;
    while (this.chunkGroup.children.length) this.chunkGroup.remove(this.chunkGroup.children[0]);
    while (this.sprinkleGroup.children.length) this.sprinkleGroup.remove(this.sprinkleGroup.children[0]);
  }

  update(dt, time) {
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt * 3.8);
      const s = 1 + Math.sin(this.bounce * Math.PI) * 0.14;
      this.group.scale.set(s, 1 / Math.sqrt(s), s);
    } else {
      this.group.scale.set(1, 1, 1);
    }
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 2.5);
      this.group.rotation.z = Math.sin(time * 24) * 0.12 * this.wobble;
    } else if (!this.isDragging) {
      this.group.rotation.z *= 0.85;
    }
  }
}

// ---------- CHOPSTICKS PAIR ----------
export class ChopstickPair {
  constructor(idx, cfg, homePos, scene) {
    this.idx = idx;
    this.role = cfg.role;
    this.accentColor = cfg.accentColor;
    this.homePos = homePos.clone();
    this.seat = null;
    this.isDragging = false;
    this.bounce = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.homePos);
    scene.add(this.group);

    for (const zOff of [-0.032, 0.032]) {
      const stick = createToonMesh(
        new THREE.CylinderGeometry(0.015, 0.026, 0.64, 8),
        0xe8b572,
        { outline: 0.013 }
      );
      stick.rotation.z = Math.PI / 2;
      stick.position.set(0, 0.025, zOff);
      this.group.add(stick);

      // Colored lacquer handle band
      const band = createToonMesh(
        new THREE.CylinderGeometry(0.024, 0.027, 0.2, 8),
        cfg.accentColor,
        { outline: 0.013 }
      );
      band.rotation.z = Math.PI / 2;
      band.position.set(0.22, 0.025, zOff);
      this.group.add(band);
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.2, 0.24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.05;
    hit.userData.interactKind = 'chopsticks';
    hit.userData.item = this;
    this.group.add(hit);
    this.hitMesh = hit;
  }

  update(dt) {
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt * 4.5);
      const s = 1 + Math.sin(this.bounce * Math.PI) * 0.16;
      this.group.scale.set(s, s, s);
    } else {
      this.group.scale.set(1, 1, 1);
    }
  }
}

// ---------- CUP (WITH SLOSHING LIQUID & OVERFLOW FOAM!) ----------
export class DinnerCup {
  constructor(idx, cfg, homePos, scene) {
    this.idx = idx;
    this.role = cfg.role;
    this.accentColor = cfg.accentColor;
    this.homePos = homePos.clone();
    this.seat = null;
    this.isDragging = false;
    this.fillLevel = 0; // 0..1
    this.bounce = 0;
    this.slosh = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.homePos);
    scene.add(this.group);

    // True hollow ceramic Japanese mug using LatheGeometry so rising golden tea is 100% visible!
    const cupPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.145, 0.0),
      new THREE.Vector2(0.185, 0.34),
      new THREE.Vector2(0.16, 0.345),
      new THREE.Vector2(0.145, 0.09),
      new THREE.Vector2(0.0, 0.08),
    ];
    const body = createToonMesh(new THREE.LatheGeometry(cupPts, 18), 0xfffaf0, {
      outline: 0.022,
    });
    this.group.add(body);

    // Bold colored stripe band
    const stripe = createToonMesh(
      new THREE.CylinderGeometry(0.175, 0.162, 0.1, 18, 1, true),
      cfg.accentColor,
      { outline: 0 }
    );
    stripe.position.y = 0.18;
    this.group.add(stripe);

    // Subtle shaded ceramic interior bottom (at y=0.09 so liquid rises cleanly above it!)
    const innerBottom = new THREE.Mesh(
      new THREE.CircleGeometry(0.142, 16),
      new THREE.MeshBasicMaterial({ color: 0x5c4b66 })
    );
    innerBottom.rotation.x = -Math.PI / 2;
    innerBottom.position.y = 0.095;
    this.group.add(innerBottom);

    // Cute C-handle
    const handle = createToonMesh(
      new THREE.TorusGeometry(0.085, 0.026, 8, 12, Math.PI),
      cfg.accentColor,
      { outline: 0.015 }
    );
    handle.position.set(0.168, 0.18, 0);
    handle.rotation.z = -Math.PI / 2;
    this.group.add(handle);

    // Rising glistening golden barley-tea liquid disc inside hollow cup!
    this.liquidGroup = new THREE.Group();
    this.liquidGroup.position.y = 0.11;
    this.liquidGroup.visible = false;
    this.group.add(this.liquidGroup);

    const liquidDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.156, 18),
      new THREE.MeshBasicMaterial({ color: 0xf6a92e })
    );
    liquidDisc.rotation.x = -Math.PI / 2;
    this.liquidGroup.add(liquidDisc);

    // Glossy anime crescent highlight on liquid surface
    const shine = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.118, 12, 1, 0.4, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xfff8cc, side: THREE.DoubleSide })
    );
    shine.rotation.x = -Math.PI / 2;
    shine.position.y = 0.004;
    this.liquidGroup.add(shine);

    // Playful overflow foam bubbles ring (appears when overflowing!)
    this.foamGroup = new THREE.Group();
    this.foamGroup.position.y = 0.35;
    this.foamGroup.visible = false;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = createToonMesh(new THREE.SphereGeometry(0.042, 8, 7), 0xfff7dc, {
        outline: 0.012,
        castShadow: false,
      });
      b.position.set(Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12);
      this.foamGroup.add(b);
    }
    this.group.add(this.foamGroup);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.44, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.2;
    hit.userData.interactKind = 'cup';
    hit.userData.item = this;
    this.group.add(hit);
    this.hitMesh = hit;
  }

  pour(amount) {
    this.fillLevel = Math.min(1.0, this.fillLevel + amount);
    this.slosh = 1.0;
    this._syncLiquid();
    return this.fillLevel >= 0.99;
  }

  sip(amount) {
    this.fillLevel = Math.max(0, this.fillLevel - amount);
    this.bounce = 0.65;
    this._syncLiquid();
  }

  _syncLiquid() {
    if (this.fillLevel <= 0.01) {
      this.liquidGroup.visible = false;
      this.foamGroup.visible = false;
      return;
    }
    this.liquidGroup.visible = true;
    // Map fillLevel 0..1 to height 0.12..0.345 inside cup
    this.liquidGroup.position.y = 0.12 + this.fillLevel * 0.226;
    const r = 0.85 + this.fillLevel * 0.16;
    this.liquidGroup.scale.set(r, 1, r);
  }

  showOverflowFoam(active) {
    this.foamGroup.visible = active;
  }

  update(dt, time) {
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt * 4.2);
      const s = 1 + Math.sin(this.bounce * Math.PI) * 0.14;
      this.group.scale.set(s, 1 / Math.sqrt(s), s);
    } else {
      this.group.scale.set(1, 1, 1);
    }
    if (this.slosh > 0) {
      this.slosh = Math.max(0, this.slosh - dt * 2.2);
      this.liquidGroup.rotation.x = Math.sin(time * 16) * 0.16 * this.slosh;
      this.liquidGroup.rotation.z = Math.cos(time * 14) * 0.16 * this.slosh;
    }
    if (this.foamGroup.visible) {
      this.foamGroup.rotation.y += dt * 2.4;
      const pulse = 1 + Math.sin(time * 12) * 0.12;
      this.foamGroup.scale.set(pulse, pulse, pulse);
    }
  }
}

// ---------- STEAMING CLAY DONABE POT + LID + SWIRLING STEW ----------
export class DinnerPot {
  constructor(pos, scene) {
    this.pos = pos.clone();
    this.lidOpen = false;
    this.menuIndex = 0;
    this.swirlAngle = 0;
    this.swirlSpeed = 0.22;
    this.rattle = 0;

    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);

    // Classic cozy dark-terracotta Japanese Donabe body!
    const potPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.45, 0.0),
      new THREE.Vector2(0.62, 0.14),
      new THREE.Vector2(0.65, 0.34),
      new THREE.Vector2(0.61, 0.44),
      new THREE.Vector2(0.54, 0.44),
      new THREE.Vector2(0.52, 0.16),
      new THREE.Vector2(0.0, 0.12),
    ];
    const potBody = createToonMesh(new THREE.LatheGeometry(potPts, 24), 0x4b3332, {
      outline: 0.03,
    });
    this.group.add(potBody);

    // Ceramic cream trim stripe around pot
    const rimBand = createToonMesh(
      new THREE.TorusGeometry(0.605, 0.04, 8, 24),
      0xf5e3c6,
      { outline: 0.018 }
    );
    rimBand.rotation.x = Math.PI / 2;
    rimBand.position.y = 0.41;
    this.group.add(rimBand);

    // Side ear handles
    for (const dir of [-1, 1]) {
      const ear = createToonMesh(new THREE.BoxGeometry(0.14, 0.09, 0.24), 0x4b3332, {
        outline: 0.022,
      });
      ear.position.set(dir * 0.68, 0.35, 0);
      this.group.add(ear);
    }

    // Swirling rich stew surface inside pot
    this.stewGroup = new THREE.Group();
    this.stewGroup.position.y = 0.37;
    this.group.add(this.stewGroup);

    this.stewSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 22),
      createToonMaterial(DINNER_MENUS[0].brothColor, { steps: 2 })
    );
    this.stewSurface.rotation.x = -Math.PI / 2;
    this.stewGroup.add(this.stewSurface);

    // Swirl shine arc on stew surface
    this.swirlShine = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.32, 14, 1, 0, 2.2),
      new THREE.MeshBasicMaterial({ color: DINNER_MENUS[0].brothHighlight, side: THREE.DoubleSide })
    );
    this.swirlShine.rotation.x = -Math.PI / 2;
    this.swirlShine.position.y = 0.006;
    this.stewGroup.add(this.swirlShine);

    // Floating chunky veggies/ingredients inside stew!
    this.chunkHolder = new THREE.Group();
    this.stewGroup.add(this.chunkHolder);
    this._populateChunks(0);

    // Domed Donabe Lid (with warm terracotta finish & top knob!)
    this.lidGroup = new THREE.Group();
    this.lidClosedPos = new THREE.Vector3(0, 0.42, 0);
    // Park cleanly in the open wood space between pot and left placemat — 100% open stew view!
    this.lidOpenPos = new THREE.Vector3(-1.12, -0.01, -0.78);
    this.lidGroup.position.copy(this.lidClosedPos);
    this.group.add(this.lidGroup);

    const lidDome = createToonMesh(
      new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
      0xd95f3c,
      { outline: 0.028 }
    );
    lidDome.scale.set(1, 0.56, 1);
    this.lidGroup.add(lidDome);

    // Cute cream lid stripe + round handle knob
    const lidKnob = createToonMesh(new THREE.CylinderGeometry(0.11, 0.075, 0.14, 14), 0xfff3d9, {
      outline: 0.022,
    });
    lidKnob.position.y = 0.34;
    this.lidGroup.add(lidKnob);

    // Steam vent hole dot
    const vent = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 10),
      new THREE.MeshBasicMaterial({ color: INK_COLOR })
    );
    vent.rotation.x = -Math.PI / 2;
    vent.position.set(0.22, 0.27, 0.14);
    this.lidGroup.add(vent);

    // Touch hitboxes for lid and pot interior
    const lidHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.42, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lidHit.position.y = 0.2;
    lidHit.userData.interactKind = 'lid';
    lidHit.userData.item = this;
    this.lidGroup.add(lidHit);
    this.lidHitMesh = lidHit;

    const potHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.45, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    potHit.position.y = 0.24;
    potHit.userData.interactKind = 'pot';
    potHit.userData.item = this;
    this.group.add(potHit);
    this.potHitMesh = potHit;
  }

  _populateChunks(menuIndex) {
    while (this.chunkHolder.children.length) {
      this.chunkHolder.remove(this.chunkHolder.children[0]);
    }
    const menu = DINNER_MENUS[menuIndex];
    this.stewSurface.material.color.setHex(menu.brothColor);
    this.swirlShine.material.color.setHex(menu.brothHighlight);

    for (let i = 0; i < 10; i++) {
      const ci = i % menu.chunkKinds.length;
      const chunk = createChunkMesh(menu.chunkKinds[ci], menu.chunkColors[ci], 1.15);
      const a = (i / 10) * Math.PI * 2;
      const r = 0.13 + (i % 3) * 0.12;
      chunk.position.set(Math.cos(a) * r, 0.025, Math.sin(a) * r);
      chunk.userData.baseAngle = a;
      chunk.userData.radius = r;
      chunk.userData.bobPhase = i * 1.1;
      this.chunkHolder.add(chunk);
    }
  }

  setMenu(menuIndex) {
    this.menuIndex = menuIndex % DINNER_MENUS.length;
    this._populateChunks(this.menuIndex);
    this.rattle = 1.0;
  }

  stir(deltaAngle) {
    this.swirlSpeed = THREE.MathUtils.clamp(this.swirlSpeed + Math.abs(deltaAngle) * 3.5, 0.22, 6.0);
    this.swirlAngle += deltaAngle * 1.6;
  }

  setLidOpen(open) {
    this.lidOpen = open;
    this.rattle = 0.8;
  }

  update(dt, time) {
    // Smoothly animate lid between closed and parked-open positions
    const targetLidPos = this.lidOpen ? this.lidOpenPos : this.lidClosedPos;
    this.lidGroup.position.lerp(targetLidPos, Math.min(1, dt * 10));
    const targetRotZ = this.lidOpen ? 0.06 : 0;
    this.lidGroup.rotation.z += (targetRotZ - this.lidGroup.rotation.z) * Math.min(1, dt * 10);

    // Gentle inviting steam-rattle when closed!
    if (!this.lidOpen) {
      const steamPulse = Math.max(0, Math.sin(time * 2.1)) > 0.72 ? Math.sin(time * 36) * 0.045 : 0;
      const manualRattle = this.rattle > 0 ? Math.sin(time * 42) * 0.1 * this.rattle : 0;
      this.lidGroup.rotation.x = steamPulse + manualRattle;
      this.lidGroup.position.y = this.lidClosedPos.y + Math.abs(steamPulse + manualRattle) * 0.4;
    } else {
      this.lidGroup.rotation.x *= 0.85;
    }
    this.rattle = Math.max(0, this.rattle - dt * 2.5);

    // Swirl stew + bobbing chunks!
    this.swirlSpeed += (0.24 - this.swirlSpeed) * Math.min(1, dt * 2.2);
    this.swirlAngle += this.swirlSpeed * dt;
    this.stewGroup.rotation.y = this.swirlAngle;

    for (const chunk of this.chunkHolder.children) {
      chunk.position.y = 0.022 + Math.sin(time * 4.5 + chunk.userData.bobPhase) * 0.016;
    }
  }
}

// ---------- LADLE (おたま) ----------
export class DinnerLadle {
  constructor(homePos, scene) {
    this.homePos = homePos.clone();
    this.isDragging = false;
    this.hasScoop = false;
    this.scoopMenuIndex = 0;
    this.tilt = 0;

    this.group = new THREE.Group();
    this.group.position.copy(homePos);
    scene.add(this.group);

    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    // Deep glossy steel/cream ladle bowl
    const bowl = createToonMesh(
      new THREE.SphereGeometry(0.185, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      0xe6eef7,
      { outline: 0.022, side: THREE.DoubleSide }
    );
    bowl.position.set(0, 0.12, 0);
    this.pivot.add(bowl);

    // Wooden handle angled up and right
    const handle = createToonMesh(
      new THREE.CapsuleGeometry(0.032, 0.72, 6, 10),
      0xd98a47,
      { outline: 0.018 }
    );
    handle.position.set(0.32, 0.44, 0.06);
    handle.rotation.z = -0.68;
    handle.rotation.x = 0.14;
    this.pivot.add(handle);

    // Red lacquer tip on handle so it's unmistakable as a grabbable handle!
    const tip = createToonMesh(new THREE.SphereGeometry(0.048, 10, 8), 0xe84a3c, {
      outline: 0.016,
    });
    tip.position.set(0.56, 0.72, 0.1);
    this.pivot.add(tip);

    // Scooped stew mound inside ladle bowl!
    this.scoopGroup = new THREE.Group();
    this.scoopGroup.position.set(0, 0.1, 0);
    this.scoopGroup.visible = false;
    this.pivot.add(this.scoopGroup);

    this.scoopBroth = createToonMesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      DINNER_MENUS[0].brothColor,
      { outline: 0.014 }
    );
    this.scoopBroth.scale.set(1, 0.58, 1);
    this.scoopGroup.add(this.scoopBroth);

    this.scoopChunks = new THREE.Group();
    this.scoopGroup.add(this.scoopChunks);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0.14, 0.24, 0.02);
    hit.userData.interactKind = 'ladle';
    hit.userData.item = this;
    this.pivot.add(hit);
    this.hitMesh = hit;
  }

  fillScoop(menuIndex) {
    this.hasScoop = true;
    this.scoopMenuIndex = menuIndex;
    const menu = DINNER_MENUS[menuIndex];
    this.scoopBroth.material.color.setHex(menu.brothColor);
    while (this.scoopChunks.children.length) {
      this.scoopChunks.remove(this.scoopChunks.children[0]);
    }
    for (let i = 0; i < 3; i++) {
      const ci = Math.floor(Math.random() * menu.chunkKinds.length);
      const ch = createChunkMesh(menu.chunkKinds[ci], menu.chunkColors[ci], 0.85);
      ch.position.set((i - 1) * 0.065, 0.075, (i % 2 === 0 ? 1 : -1) * 0.04);
      this.scoopChunks.add(ch);
    }
    this.scoopGroup.visible = true;
  }

  emptyScoop() {
    this.hasScoop = false;
    this.scoopGroup.visible = false;
  }

  update(dt, time) {
    if (!this.isDragging) {
      this.group.position.lerp(this.homePos, Math.min(1, dt * 8));
      const targetY = this.homeRotY || 0;
      this.pivot.rotation.y += (targetY - this.pivot.rotation.y) * Math.min(1, dt * 8);
      this.pivot.rotation.z += (0 - this.pivot.rotation.z) * Math.min(1, dt * 8);
      this.pivot.rotation.x += (0 - this.pivot.rotation.x) * Math.min(1, dt * 8);
    } else {
      this.pivot.rotation.y += (0 - this.pivot.rotation.y) * Math.min(1, dt * 10);
      const targetRot = this.tilt;
      this.pivot.rotation.z += (targetRot - this.pivot.rotation.z) * Math.min(1, dt * 12);
    }
    if (this.hasScoop) {
      const wob = 1 + Math.sin(time * 10) * 0.05;
      this.scoopGroup.scale.set(wob, 1 / wob, wob);
    }
  }
}

// ---------- TEA / JUICE PITCHER (麦茶ポット) + POURING STREAM ----------
export class TeaPitcher {
  constructor(homePos, scene) {
    this.homePos = homePos.clone();
    this.isDragging = false;
    this.pouring = false;
    this.tilt = 0;

    this.group = new THREE.Group();
    this.group.position.copy(homePos);
    scene.add(this.group);

    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    // Chunky anime glass/ceramic pitcher filled with golden barley tea!
    const carafe = createToonMesh(
      new THREE.CylinderGeometry(0.18, 0.25, 0.56, 16),
      0xf2a634,
      { outline: 0.026 }
    );
    carafe.position.y = 0.28;
    this.bodyGroup.add(carafe);

    // Glossy anime curved highlight arc hugging the carafe!
    const gloss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.186, 0.256, 0.42, 10, 1, true, -0.55, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfff7cf, transparent: true, opacity: 0.72 })
    );
    gloss.position.y = 0.28;
    this.bodyGroup.add(gloss);

    // White collar & lid
    const lid = createToonMesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 16), 0x4db6ac, {
      outline: 0.022,
    });
    lid.position.y = 0.6;
    this.bodyGroup.add(lid);

    // Spout pointing left (-X) so tilting left pours neatly!
    const spout = createToonMesh(new THREE.ConeGeometry(0.075, 0.18, 8), 0xfff6e3, {
      outline: 0.018,
    });
    spout.rotation.z = Math.PI * 0.42;
    spout.position.set(-0.22, 0.54, 0);
    this.bodyGroup.add(spout);
    this.spoutLocal = new THREE.Vector3(-0.3, 0.54, 0);

    // Curved handle on right (+X)
    const handle = createToonMesh(
      new THREE.TorusGeometry(0.15, 0.036, 8, 14, Math.PI),
      0x4db6ac,
      { outline: 0.018 }
    );
    handle.position.set(0.21, 0.34, 0);
    handle.rotation.z = -Math.PI / 2;
    this.bodyGroup.add(handle);

    // Arched cel-shaded pouring liquid stream (shown when pouring into a cup!)
    this.streamMesh = createToonMesh(
      new THREE.CylinderGeometry(0.026, 0.042, 0.72, 10),
      0xffbe42,
      { outline: 0.012, castShadow: false }
    );
    this.streamMesh.visible = false;
    scene.add(this.streamMesh);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.72, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.34;
    hit.userData.interactKind = 'pitcher';
    hit.userData.item = this;
    this.bodyGroup.add(hit);
    this.hitMesh = hit;
  }

  setPourStream(active, targetWorldPos) {
    this.pouring = active;
    if (!active || !targetWorldPos) {
      this.streamMesh.visible = false;
      return;
    }
    this.bodyGroup.updateMatrixWorld(true);
    const spoutWorld = this.spoutLocal.clone().applyMatrix4(this.bodyGroup.matrixWorld);
    const endWorld = targetWorldPos.clone();
    endWorld.y += 0.25;

    const mid = spoutWorld.clone().lerp(endWorld, 0.5);
    const dist = spoutWorld.distanceTo(endWorld);
    this.streamMesh.position.copy(mid);
    this.streamMesh.scale.set(1, Math.max(0.2, dist / 0.72), 1);
    this.streamMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      endWorld.clone().sub(spoutWorld).normalize()
    );
    this.streamMesh.visible = true;
  }

  update(dt, time) {
    if (!this.isDragging) {
      this.group.position.lerp(this.homePos, Math.min(1, dt * 8));
      this.tilt = 0;
      this.setPourStream(false);
    }
    const targetRotZ = this.pouring ? 0.92 : this.tilt;
    this.bodyGroup.rotation.z += (targetRotZ - this.bodyGroup.rotation.z) * Math.min(1, dt * 12);
    if (this.streamMesh.visible) {
      const pulse = 1 + Math.sin(time * 28) * 0.16;
      this.streamMesh.scale.x = pulse;
      this.streamMesh.scale.z = pulse;
    }
  }
}

// ---------- SPRINKLE SHAKER (ふりかけ・パセリボトル) ----------
export class SprinkleShaker {
  constructor(homePos, scene) {
    this.homePos = homePos.clone();
    this.isDragging = false;
    this.shaking = false;

    this.group = new THREE.Group();
    this.group.position.copy(homePos);
    scene.add(this.group);

    this.body = new THREE.Group();
    this.group.add(this.body);

    const bottle = createToonMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 16), 0x52c771, {
      outline: 0.02,
    });
    bottle.position.y = 0.15;
    this.body.add(bottle);

    const label = createToonMesh(new THREE.CylinderGeometry(0.122, 0.126, 0.11, 16, 1, true), 0xfff59d, {
      outline: 0,
    });
    label.position.y = 0.15;
    this.body.add(label);

    const cap = createToonMesh(new THREE.CylinderGeometry(0.118, 0.118, 0.09, 16), 0xff5a5f, {
      outline: 0.02,
    });
    cap.position.y = 0.34;
    this.body.add(cap);

    // Cute shaker dot holes on top of red cap!
    for (const [hx, hz] of [[-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04], [0, 0]]) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.014, 8),
        new THREE.MeshBasicMaterial({ color: INK_COLOR })
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(hx, 0.388, hz);
      this.body.add(hole);
    }

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.48, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.22;
    hit.userData.interactKind = 'shaker';
    hit.userData.item = this;
    this.body.add(hit);
    this.hitMesh = hit;
  }

  update(dt, time) {
    if (!this.isDragging) {
      this.group.position.lerp(this.homePos, Math.min(1, dt * 9));
      this.shaking = false;
    }
    const targetRot = this.shaking ? Math.PI * 0.85 : 0;
    this.body.rotation.z += (targetRot - this.body.rotation.z) * Math.min(1, dt * 12);
    this.body.position.y = this.shaking ? Math.sin(time * 28) * 0.09 : 0;
  }
}

// ---------- SHINY SERVICE BELL (チーン！メニューチェンジベル) ----------
export class ServiceBell {
  constructor(homePos, scene) {
    this.homePos = homePos.clone();
    this.hiddenPos = homePos.clone().add(new THREE.Vector3(-1.8, -0.3, 0));
    this.unlocked = false;
    this.ringBounce = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.hiddenPos);
    this.group.visible = false;
    scene.add(this.group);

    const base = createToonMesh(new THREE.CylinderGeometry(0.24, 0.26, 0.07, 16), 0x3b2a3f, {
      outline: 0.02,
    });
    base.position.y = 0.035;
    this.group.add(base);

    const dome = createToonMesh(
      new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      0xffd645,
      { outline: 0.024 }
    );
    dome.position.y = 0.06;
    this.group.add(dome);

    this.button = createToonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), 0xff5a5f, {
      outline: 0.016,
    });
    this.button.position.y = 0.29;
    this.group.add(this.button);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.42, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.18;
    hit.userData.interactKind = 'bell';
    hit.userData.item = this;
    this.group.add(hit);
    this.hitMesh = hit;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.group.visible = true;
    this.ringBounce = 1.0;
  }

  ring() {
    this.ringBounce = 1.0;
  }

  update(dt, time) {
    if (!this.unlocked) return;
    this.group.position.lerp(this.homePos, Math.min(1, dt * 6));
    if (this.ringBounce > 0) {
      this.ringBounce = Math.max(0, this.ringBounce - dt * 3.5);
      const s = 1 + Math.sin(this.ringBounce * Math.PI) * 0.22;
      this.group.scale.set(s, 1 / Math.sqrt(s), s);
      this.button.position.y = 0.29 - Math.sin(this.ringBounce * Math.PI) * 0.045;
    } else {
      // Subtle inviting golden bob once feast is ready to replay
      const b = 1 + Math.sin(time * 4.5) * 0.04;
      this.group.scale.set(b, b, b);
      this.button.position.y = 0.29;
    }
  }
}
