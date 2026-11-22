import * as THREE from '../vendor/three/three.module.min.js';
import { createClayMaterial, createGlossyClayMaterial } from './clayMaterial.js';
import { sculptClay, makeClayBlob, makeClayPuck, makeClayHeart, makeClayStar } from './clayGeo.js';
import { DINING_CENTER } from './kitchenScene.js';
import { audio } from './audio.js';

export class StageServe {
  constructor(scene, diorama, decorateStage, recipeState, onReplay) {
    this.scene = scene;
    this.diorama = diorama;
    this.decorate = decorateStage;
    this.recipe = recipeState;
    this.onReplay = onReplay;

    this.group = new THREE.Group();
    this.group.position.set(DINING_CENTER.x, 0.06, DINING_CENTER.z + 0.14);
    scene.add(this.group);

    this.active = false;
    this.bitesTaken = 0;
    this.maxBites = 5;
    this.finished = false;

    this.members = []; // [papa, mama, sibling]
    this.flyingScoop = null;
    this.scoopAnim = null;
    this.particles = [];
    this.replayPanGroup = null;
    this.replayReady = false;
    this.replayPopT = 0;

    // Plate drag-to-feed state
    this.draggingPlate = false;

    this._buildFamily();
    this._buildFlyingScoop();
    this._buildParticlePool();
    this._buildReplayPan();

    // Family stays visible at the dining table even during Stage 3 (so goal is visible!)
    this.group.visible = true;
  }

  _buildClayMember(cfg) {
    const root = new THREE.Group();
    root.position.set(cfg.x, 0, cfg.z);

    const sc = cfg.scale || 1.0;
    const bodyGroup = new THREE.Group();
    bodyGroup.scale.setScalar(sc);
    root.add(bodyGroup);

    const skinMat = createClayMaterial(cfg.skin, { normalStrength: 0.95, roughness: 0.78 });
    const shirtMat = createClayMaterial(cfg.shirt, { normalStrength: 1.0, roughness: 0.84 });
    const hairMat = createClayMaterial(cfg.hair, { normalStrength: 1.0, roughness: 0.84 });
    const eyeMat = createGlossyClayMaterial('#241f20', { roughness: 0.2, normalStrength: 0.3 });
    const cheekMat = createClayMaterial('#ee8980', { normalStrength: 0.8, roughness: 0.8 });

    // Torso / sweater
    const torsoGeo = makeClayBlob(0.62, 16, 12, {
      amp: 0.045,
      seed: cfg.seed,
      scaleX: 1.08,
      scaleY: 1.18,
      scaleZ: 0.82,
      flattenBottom: -0.5,
    });
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 0.65;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Optional toddler bib for Little Sibling
    if (cfg.role === 'sibling') {
      const bib = new THREE.Mesh(
        makeClayBlob(0.38, 12, 10, { amp: 0.04, seed: 88, scaleX: 1.05, scaleY: 0.95, scaleZ: 0.45 }),
        createClayMaterial('#9ad0e6', { normalStrength: 0.9 })
      );
      bib.position.set(0, 0.86, 0.36);
      bodyGroup.add(bib);

      const bibStar = new THREE.Mesh(
        makeClayStar(0.11, 0.055, 0.04, 5),
        createClayMaterial('#f7cf48', { normalStrength: 0.85 })
      );
      bibStar.rotation.x = Math.PI / 2;
      bibStar.position.set(0, 0.84, 0.54);
      bodyGroup.add(bibStar);
    }

    // Head group (nods, tilts, bounces in 12fps stop-motion!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.56, 0.05);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(
      makeClayBlob(0.5, 18, 14, { amp: 0.042, seed: cfg.seed + 1, scaleX: 1.02, scaleY: 1.04 }),
      skinMat
    );
    head.castShadow = true;
    head.receiveShadow = true;
    headGroup.add(head);

    // Cute pinched clay button nose
    const nose = new THREE.Mesh(
      makeClayBlob(0.085, 10, 8, { amp: 0.05, seed: cfg.seed + 2 }),
      skinMat
    );
    nose.position.set(0, -0.02, 0.49);
    headGroup.add(nose);

    // Little clay ears
    for (let s = -1; s <= 1; s += 2) {
      const ear = new THREE.Mesh(
        makeClayBlob(0.12, 10, 8, { amp: 0.05, seed: cfg.seed + 3, scaleZ: 0.65 }),
        skinMat
      );
      ear.position.set(s * 0.48, 0.0, 0.0);
      headGroup.add(ear);
    }

    // Glossy black clay bead eyes (open) + curved happy clay-coil eyes (celebrating!)
    const openEyes = new THREE.Group();
    const happyEyes = new THREE.Group();
    happyEyes.visible = false;

    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), eyeMat);
      eye.position.set(s * 0.18, 0.08, 0.44);
      openEyes.add(eye);

      // Tiny white clay glint speck
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint.position.set(s * 0.18 + 0.022, 0.105, 0.495);
      openEyes.add(glint);

      // Happy arched clay eye coil (^)
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.072, 0.022, 6, 12, Math.PI),
        eyeMat
      );
      arch.position.set(s * 0.18, 0.06, 0.46);
      happyEyes.add(arch);
    }
    headGroup.add(openEyes, happyEyes);

    // Rosy pinched clay cheeks
    const cheeks = [];
    for (let s = -1; s <= 1; s += 2) {
      const ch = new THREE.Mesh(
        makeClayBlob(0.11, 10, 8, { amp: 0.04, seed: cfg.seed + 4, scaleZ: 0.45 }),
        cheekMat
      );
      ch.position.set(s * 0.28, -0.07, 0.42);
      headGroup.add(ch);
      cheeks.push(ch);
    }

    // Expressive clay mouth (closed smile / open "ah!" chewing)
    const smileMouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.024, 6, 12, Math.PI),
      createClayMaterial('#b54b43', { normalStrength: 0.7 })
    );
    smileMouth.rotation.z = Math.PI;
    smileMouth.position.set(0, -0.15, 0.45);
    headGroup.add(smileMouth);

    const openMouth = new THREE.Mesh(
      makeClayBlob(0.12, 10, 8, { amp: 0.04, seed: cfg.seed + 5, scaleX: 1.1, scaleY: 0.95, scaleZ: 0.5 }),
      createClayMaterial('#942b2b', { normalStrength: 0.6 })
    );
    openMouth.position.set(0, -0.19, 0.44);
    openMouth.visible = false;
    headGroup.add(openMouth);

    // Hair & distinctive clay features per family member!
    let mustache = null;
    let ketchupSmudge = null;

    if (cfg.role === 'papa') {
      // Hair cap + side curls
      const hair = new THREE.Mesh(
        makeClayBlob(0.52, 14, 10, { amp: 0.06, seed: 11, scaleY: 0.78 }),
        hairMat
      );
      hair.position.set(0, 0.22, -0.06);
      headGroup.add(hair);

      // Sculpted clay mustache (wiggles when happy!)
      mustache = new THREE.Group();
      mustache.position.set(0, -0.11, 0.48);
      for (let s = -1; s <= 1; s += 2) {
        const m = new THREE.Mesh(
          makeClayBlob(0.11, 10, 8, { amp: 0.06, seed: 13, scaleX: 1.6, scaleY: 0.62, scaleZ: 0.55 }),
          hairMat
        );
        m.position.set(s * 0.11, 0, 0);
        m.rotation.z = -s * 0.22;
        mustache.add(m);
      }
      headGroup.add(mustache);

      // Round clay glasses rims
      const glassMat = createClayMaterial('#5c4632', { normalStrength: 0.7 });
      for (let s = -1; s <= 1; s += 2) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 16), glassMat);
        rim.position.set(s * 0.18, 0.08, 0.47);
        headGroup.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.026, 0.026), glassMat);
      bridge.position.set(0, 0.09, 0.47);
      headGroup.add(bridge);
    } else if (cfg.role === 'mama') {
      // Soft sculpted clay bob hair + cozy top bun!
      const hair = new THREE.Mesh(
        makeClayBlob(0.54, 16, 12, { amp: 0.05, seed: 21, scaleX: 1.06, scaleY: 0.92 }),
        hairMat
      );
      hair.position.set(0, 0.16, -0.09);
      headGroup.add(hair);

      const bun = new THREE.Mesh(
        makeClayBlob(0.24, 12, 10, { amp: 0.06, seed: 22 }),
        hairMat
      );
      bun.position.set(0, 0.58, -0.14);
      bun.castShadow = true;
      headGroup.add(bun);

      // Cute clay hair ribbon band
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.045, 6, 14),
        createClayMaterial('#e86858', { normalStrength: 0.9 })
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.44, -0.12);
      headGroup.add(band);
    } else {
      // Toddler cute bangs + little top sprout hair!
      const hair = new THREE.Mesh(
        makeClayBlob(0.5, 14, 10, { amp: 0.07, seed: 31, scaleY: 0.72 }),
        hairMat
      );
      hair.position.set(0, 0.22, -0.05);
      headGroup.add(hair);

      const tuft = new THREE.Mesh(
        makeClayBlob(0.14, 8, 6, { amp: 0.09, seed: 32, scaleY: 1.3 }),
        hairMat
      );
      tuft.position.set(0.04, 0.58, 0.04);
      tuft.rotation.z = -0.3;
      headGroup.add(tuft);

      // Cheeky red clay ketchup smudge (appears after eating, tap to wipe off!)
      ketchupSmudge = new THREE.Mesh(
        makeClayBlob(0.085, 8, 6, { amp: 0.1, seed: 39, scaleX: 1.25, scaleY: 0.75, scaleZ: 0.35 }),
        createGlossyClayMaterial('#d92418', { roughness: 0.28 })
      );
      ketchupSmudge.position.set(-0.27, -0.08, 0.46);
      ketchupSmudge.visible = false;
      const smudgeHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      smudgeHit.userData = { interact: 'ketchupSmudge' };
      ketchupSmudge.add(smudgeHit);
      headGroup.add(ketchupSmudge);
    }

    // Movable clay arms + miniature clay spoon in right hand!
    const armGeo = makeClayBlob(0.18, 10, 8, { amp: 0.05, seed: cfg.seed + 7, scaleY: 1.85 });
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.56, 0.92, 0.14);
    const lMesh = new THREE.Mesh(armGeo, shirtMat);
    lMesh.position.y = -0.22;
    lMesh.castShadow = true;
    leftArm.add(lMesh);
    const lHand = new THREE.Mesh(makeClayBlob(0.14, 8, 6, { seed: 4 }), skinMat);
    lHand.position.set(0, -0.45, 0.06);
    leftArm.add(lHand);
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.56, 0.92, 0.14);
    const rMesh = new THREE.Mesh(armGeo, shirtMat);
    rMesh.position.y = -0.22;
    rMesh.castShadow = true;
    rightArm.add(rMesh);
    const rHand = new THREE.Mesh(makeClayBlob(0.14, 8, 6, { seed: 5 }), skinMat);
    rHand.position.set(0, -0.45, 0.06);
    rightArm.add(rHand);

    // Cute miniature clay spoon in right hand!
    const spoonMat = createClayMaterial('#d6d0c7', { roughness: 0.45, metalness: 0.25, normalStrength: 0.6 });
    const spoonStick = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.52, 8), spoonMat);
    spoonStick.position.set(0, -0.38, 0.28);
    spoonStick.rotation.x = Math.PI / 2.2;
    rightArm.add(spoonStick);
    const spoonBowl = new THREE.Mesh(
      makeClayBlob(0.11, 8, 6, { scaleX: 0.85, scaleY: 0.35, scaleZ: 1.25 }),
      spoonMat
    );
    spoonBowl.position.set(0, -0.34, 0.56);
    rightArm.add(spoonBowl);

    bodyGroup.add(rightArm);

    // Generous touch hitbox over the whole character so 5yo taps always land!
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82 * sc, 0.82 * sc, 2.3 * sc, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.15 * sc;
    hit.userData = { interact: 'familyMember', memberIdx: cfg.idx };
    root.add(hit);

    this.group.add(root);

    return {
      idx: cfg.idx,
      role: cfg.role,
      root,
      bodyGroup,
      headGroup,
      leftArm,
      rightArm,
      openEyes,
      happyEyes,
      smileMouth,
      openMouth,
      mustache,
      ketchupSmudge,
      state: 'waiting', // 'waiting' | 'eating' | 'happy'
      stateTimer: 0,
      hasSmudge: false,
      mouthWorldLocal: new THREE.Vector3(cfg.x, 1.38 * sc, cfg.z + 0.55 * sc),
    };
  }

  _buildFamily() {
    const configs = [
      { idx: 0, role: 'papa', x: -1.68, z: -1.85, scale: 1.06, skin: '#f5ccb0', shirt: '#6f8f69', hair: '#4a382c', seed: 10 },
      { idx: 1, role: 'mama', x: 0.0, z: -2.02, scale: 1.0, skin: '#f7d2b8', shirt: '#df7b63', hair: '#5c3c28', seed: 20 },
      { idx: 2, role: 'sibling', x: 1.62, z: -1.78, scale: 0.82, skin: '#fad8c0', shirt: '#f0b956', hair: '#543b2a', seed: 30 },
    ];
    configs.forEach((cfg) => {
      this.members.push(this._buildClayMember(cfg));
    });
  }

  _buildFlyingScoop() {
    // A juicy clay spoonful of golden egg + red ketchup rice that flies to whoever you feed!
    const g = new THREE.Group();
    const riceBit = new THREE.Mesh(
      makeClayBlob(0.2, 10, 8, { amp: 0.1, seed: 61, scaleY: 0.72 }),
      createClayMaterial('#e35832', { normalStrength: 1.0 })
    );
    g.add(riceBit);

    const eggCap = new THREE.Mesh(
      makeClayBlob(0.22, 10, 8, { amp: 0.08, seed: 62, scaleY: 0.42 }),
      createClayMaterial('#f5c02e', { normalStrength: 0.95 })
    );
    eggCap.position.y = 0.09;
    g.add(eggCap);

    const kDot = new THREE.Mesh(
      makeClayBlob(0.08, 8, 6, { amp: 0.08, seed: 63, scaleY: 0.6 }),
      createGlossyClayMaterial('#d92418', { roughness: 0.28 })
    );
    kDot.position.y = 0.18;
    g.add(kDot);

    g.visible = false;
    this.flyingScoop = { group: g, riceBit };
    this.group.add(g);
  }

  _buildParticlePool() {
    const heartGeo = makeClayHeart(0.18, 0.07);
    const starGeo = makeClayStar(0.18, 0.09, 0.07, 5);
    const colors = ['#f26d7d', '#f7c542', '#7ac770', '#f59542', '#e85d50'];
    for (let i = 0; i < 18; i++) {
      const mat = createClayMaterial(colors[i % colors.length], { normalStrength: 0.9, roughness: 0.72 });
      const mesh = new THREE.Mesh(i % 2 === 0 ? heartGeo : starGeo, mat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        active: false,
        age: 0,
        life: 1.2,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }
  }

  _buildReplayPan() {
    // Miniature inviting clay frying pan with a tiny bobbing egg neatly beside the empty plate -> tap to cook again!
    const g = new THREE.Group();
    g.position.set(2.28, 0.08, -0.55);
    g.rotation.y = 0.55;

    const panMat = createClayMaterial('#3e3d42', { normalStrength: 0.95 });
    const pan = new THREE.Mesh(makeClayPuck(0.46, 0.14, 0.045, 18, { amp: 0.03, seed: 91 }), panMat);
    pan.position.y = 0.07;
    pan.castShadow = true;
    g.add(pan);

    const handle = new THREE.Mesh(
      sculptClay(new THREE.CylinderGeometry(0.052, 0.07, 0.56, 10), { amp: 0.04, seed: 92 }),
      createClayMaterial('#c77a48', { normalStrength: 0.95 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.62, 0.11, 0);
    handle.castShadow = true;
    g.add(handle);

    // Cute sunny-side-up mini clay egg inside the replay pan!
    const white = new THREE.Mesh(
      makeClayPuck(0.28, 0.055, 0.025, 14, { amp: 0.12, seed: 93 }),
      createClayMaterial('#f8f3e6', { normalStrength: 0.8 })
    );
    white.position.y = 0.16;
    g.add(white);
    const yolk = new THREE.Mesh(
      makeClayBlob(0.125, 10, 8, { amp: 0.05, seed: 94, scaleY: 0.7 }),
      createGlossyClayMaterial('#f7ae1e', { roughness: 0.3 })
    );
    yolk.position.y = 0.21;
    g.add(yolk);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.25;
    hit.userData = { interact: 'replayPan' };
    g.add(hit);

    g.visible = false;
    this.replayPanGroup = g;
    this.group.add(g);
  }

  _spawnBurst(x, y, z, count = 5) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.life = 1.05 + Math.random() * 0.45;
        const a = (spawned / count) * Math.PI * 2 + Math.random() * 0.5;
        p.vx = Math.cos(a) * (0.65 + Math.random() * 0.4);
        p.vy = 1.65 + Math.random() * 0.75;
        p.vz = Math.sin(a) * 0.45;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(0.1);
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  enter() {
    this.active = true;
    this.bitesTaken = 0;
    this.finished = false;
    this.replayReady = false;
    this.replayPopT = 0;
    this.replayPanGroup.visible = false;
    this.scoopAnim = null;
    this.flyingScoop.group.visible = false;
    this.draggingPlate = false;

    this.flyingScoop.riceBit.material.color.set(this.recipe.riceColorHex || '#e35832');

    this.members.forEach((m) => {
      m.state = 'waiting';
      m.stateTimer = 0;
      m.hasSmudge = false;
      m.openEyes.visible = true;
      m.happyEyes.visible = false;
      m.smileMouth.visible = true;
      m.openMouth.visible = false;
      if (m.ketchupSmudge) m.ketchupSmudge.visible = false;
    });

    // If the child decorated the omurice, family starts with a joyful admiring sparkle!
    if ((this.recipe.decorStrokes || 0) >= 1) {
      this._spawnBurst(0, 1.9, -1.6, 5);
    }
  }

  exit() {
    this.active = false;
    this.replayPanGroup.visible = false;
    this.scoopAnim = null;
    this.flyingScoop.group.visible = false;
  }

  feedMember(memberIdx) {
    if (!this.active || this.finished || this.scoopAnim) return;
    const m = this.members[memberIdx];
    if (!m) return;

    this.bitesTaken++;
    audio.playPop(1.1);

    // Launch a juicy clay spoonful from the omurice toward this family member's mouth!
    const start = new THREE.Vector3(
      this.decorate.plateGroup.position.x,
      0.75,
      this.decorate.plateGroup.position.z
    );
    this.scoopAnim = {
      member: m,
      start,
      end: m.mouthWorldLocal.clone(),
      t: 0,
    };
    this.flyingScoop.group.position.copy(start);
    this.flyingScoop.group.visible = true;
    this.flyingScoop.group.scale.setScalar(1);

    // Open mouth eagerly!
    m.openMouth.visible = true;
    m.smileMouth.visible = false;

    // Physically scoop the omurice bit by bit, revealing the steaming red ketchup rice & peas inside!
    const remain = Math.max(0, 1 - this.bitesTaken / this.maxBites);
    if (this.bitesTaken >= 1 && remain > 0.01) {
      this.decorate.omuriceInnerRice.visible = true;
      const sx = 0.28 + remain * 0.72;
      const sy = 0.52 + remain * 0.48;
      this.decorate.omuriceMesh.scale.set(sx * 0.88, sy, 0.86 + remain * 0.14);
      this.decorate.omuriceMesh.position.x = -0.22 * (1 - remain);
      this.decorate.omuriceInnerRice.scale.set(sx * 1.02, sy * 0.96, 0.88 + remain * 0.12);
      this.decorate.omuriceInnerRice.position.x = 0.08 * (1 - remain);
      this.decorate.decorLayer.scale.set(sx * 0.88, sy, 0.86 + remain * 0.14);
      this.decorate.decorLayer.position.x = -0.22 * (1 - remain);
    } else if (remain <= 0.01) {
      // Plate licked happily clean!
      this.decorate.omuriceMesh.visible = false;
      this.decorate.omuriceInnerRice.visible = false;
      this.decorate.decorLayer.visible = false;
    }
  }

  onPointerDown(hit) {
    if (!this.active) return false;
    if (!hit) return false;

    const kind = hit.object.userData?.interact;
    if (kind === 'replayPan' && this.replayReady) {
      audio.playStageDone();
      if (this.onReplay) this.onReplay();
      return true;
    }
    if (kind === 'ketchupSmudge') {
      const sib = this.members[2];
      if (sib && sib.hasSmudge) {
        sib.hasSmudge = false;
        sib.ketchupSmudge.visible = false;
        audio.playWipe();
        audio.playFamilyHappy(2);
        this._spawnBurst(sib.root.position.x, 1.9, sib.root.position.z + 0.3, 5);
        return true;
      }
    }
    if (kind === 'familyMember') {
      const idx = hit.object.userData.memberIdx;
      if (!this.finished) {
        this.feedMember(idx);
      } else {
        // Even after eating, tapping a happy family member makes them cheer & wave!
        const m = this.members[idx];
        if (m) {
          m.state = 'happy';
          m.stateTimer = 0;
          audio.playFamilyHappy(idx);
          this._spawnBurst(m.root.position.x, 2.2, m.root.position.z + 0.2, 4);
        }
      }
      return true;
    }
    if (kind === 'omuriceCanvas' && !this.finished) {
      this.draggingPlate = true;
      audio.playClaySquish(1.0);
      return true;
    }
    return false;
  }

  onPointerMove(worldOnTable) {
    if (!this.active || !this.draggingPlate || !worldOnTable || this.finished) return;
    const localX = THREE.MathUtils.clamp(worldOnTable.x - DINING_CENTER.x, -1.65, 1.65);
    const localZ = THREE.MathUtils.clamp(worldOnTable.z - (DINING_CENTER.z + 0.12), -0.95, 0.45);
    this.decorate.plateGroup.position.set(localX, 0, localZ);

    // Dragging the plate forward toward Papa / Mama / Sibling feeds them automatically!
    if (localZ < -0.45 && !this.scoopAnim) {
      const memberIdx = localX < -0.58 ? 0 : localX > 0.58 ? 2 : 1;
      this.draggingPlate = false;
      this.feedMember(memberIdx);
    }
  }

  onPointerUp() {
    if (this.draggingPlate && !this.finished && !this.scoopAnim) {
      // Even a simple tap on the omurice feeds the next family member in turn!
      this.feedMember(this.bitesTaken % 3);
    }
    this.draggingPlate = false;
  }

  update(dt, elapsed, stopMotionStep) {
    // 1. Gently return plate to center when not dragging
    if (this.active && !this.draggingPlate) {
      this.decorate.plateGroup.position.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 8));
    }

    // 2. Flying clay spoonful animation
    if (this.scoopAnim) {
      this.scoopAnim.t += dt * 2.1;
      const t = Math.min(1, this.scoopAnim.t);
      const qt = Math.floor(t * 14) / 14;
      this.flyingScoop.group.position.lerpVectors(this.scoopAnim.start, this.scoopAnim.end, qt);
      this.flyingScoop.group.position.y += Math.sin(qt * Math.PI) * 1.15;
      this.flyingScoop.group.rotation.y = qt * Math.PI * 2;

      if (t >= 1) {
        const m = this.scoopAnim.member;
        this.flyingScoop.group.visible = false;
        this.scoopAnim = null;

        m.state = 'eating';
        m.stateTimer = 0;
        audio.playChew(m.idx);

        // Little Sibling gets a silly red clay ketchup smudge on their cheek!
        if (m.role === 'sibling' && m.ketchupSmudge) {
          m.hasSmudge = true;
          m.ketchupSmudge.visible = true;
        }

        if (this.bitesTaken >= this.maxBites) {
          this.finished = true;
        }
      }
    }

    // 3. Stop-motion 12fps animation for Papa, Mama, and Little Sibling!
    const smPhase = stopMotionStep * 0.45;
    this.members.forEach((m, idx) => {
      m.stateTimer += dt;

      if (m.state === 'eating') {
        // Chewing mogu-mogu!
        const chew = Math.sin(stopMotionStep * 2.2) > 0;
        m.openMouth.visible = chew;
        m.smileMouth.visible = !chew;
        m.headGroup.rotation.x = chew ? 0.12 : -0.06;
        m.rightArm.rotation.x = -0.85;
        if (m.stateTimer > 0.72) {
          m.state = 'happy';
          m.stateTimer = 0;
          m.openMouth.visible = false;
          m.smileMouth.visible = true;
          m.openEyes.visible = false;
          m.happyEyes.visible = true;
          audio.playFamilyHappy(idx);
          this._spawnBurst(m.root.position.x, 2.2, m.root.position.z + 0.25, 6);

          // If all bites eaten, celebrate together & pop up replay pan + kitchen souvenir star!
          if (this.finished && !this.replayReady) {
            this.replayReady = true;
            this.replayPopT = 0;
            this.replayPanGroup.visible = true;
            this.diorama.addSouvenirStar();
            this.decorate.decorLayer.visible = true;
            this.decorate.decorLayer.scale.setScalar(1);
            this.decorate.decorLayer.position.set(0, 0, 0);
            this.decorate.clearDecorations();
            // Whole family smiles happy!
            this.members.forEach((fm) => {
              fm.state = 'happy';
              fm.stateTimer = 0;
              fm.openEyes.visible = false;
              fm.happyEyes.visible = true;
            });
          }
        }
      } else if (m.state === 'happy') {
        const bounce = Math.abs(Math.sin(stopMotionStep * 1.15 + idx)) * 0.16;
        m.bodyGroup.position.y = bounce;
        m.headGroup.rotation.z = Math.sin(stopMotionStep * 1.15 + idx) * 0.16;
        m.headGroup.rotation.x = -0.06;
        // Raised happy cheering / clapping clay arms!
        m.leftArm.rotation.z = -0.65 - Math.sin(stopMotionStep * 1.4) * 0.22;
        m.rightArm.rotation.z = 0.65 + Math.sin(stopMotionStep * 1.4) * 0.22;
        m.rightArm.rotation.x = -0.45;
        if (m.mustache) {
          m.mustache.rotation.z = Math.sin(stopMotionStep * 2.5) * 0.22;
        }
        if (!this.finished && m.stateTimer > 2.2) {
          m.state = 'waiting';
          m.openEyes.visible = true;
          m.happyEyes.visible = false;
        }
      } else {
        // Excited waiting pose looking warmly down at the omurice!
        const eager = this.active ? 1.0 : 0.45;
        const bob = Math.sin(smPhase + idx * 1.7) * 0.04 * eager;
        m.bodyGroup.position.y = Math.max(0, bob);
        m.headGroup.rotation.x = this.active ? 0.16 : 0.22;
        m.headGroup.rotation.z = Math.sin(smPhase * 0.7 + idx * 2.1) * 0.06;
        m.leftArm.rotation.z = -0.15;
        m.rightArm.rotation.z = 0.15;
        // Gentle excited spoon tap when Stage 4 is active!
        m.rightArm.rotation.x = this.active ? -0.35 + Math.sin(stopMotionStep * 0.8 + idx) * 0.16 : -0.18;
        if (m.mustache) m.mustache.rotation.z = 0;
      }
    });

    // 4. Stop-motion floating clay hearts & stars
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 1.6 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const qt = Math.floor(t * 10) / 10;
      const sc = Math.sin(qt * Math.PI) * 1.15;
      p.mesh.scale.setScalar(Math.max(0.05, sc));
      p.mesh.rotation.y = stopMotionStep * 0.5 + i;
    }

    // 5. Replay mini-pan pop-in & inviting claymation hop!
    if (this.replayReady && this.replayPanGroup.visible) {
      this.replayPopT = Math.min(1, this.replayPopT + dt * 2.6);
      const pop = 1 - Math.pow(1 - this.replayPopT, 3);
      const hop = Math.max(0, Math.sin(stopMotionStep * 0.55)) * 0.09;
      this.replayPanGroup.position.y = 0.08 + hop;
      this.replayPanGroup.scale.setScalar(pop);
      this.replayPanGroup.rotation.y = 0.45 + Math.sin(stopMotionStep * 0.3) * 0.14;
    }
  }
}
