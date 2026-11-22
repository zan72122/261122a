import * as THREE from 'three';
import {
  INK_COLOR,
  createToonMesh,
  createToonMaterial,
  createFaceTexture,
} from './toon.js';
import { sound } from './audio.js';

const CHAR_SPECS = {
  mama: {
    scale: 1.0,
    skin: '#ffe0c6',
    hair: 0x4b2a24,
    shirt: 0xff6b7a,
    collar: 0xfff4e6,
    glasses: false,
    hairStyle: 'bob',
    browColor: '#3d201c',
  },
  papa: {
    scale: 1.14,
    skin: '#f6d0b1',
    hair: 0x262230,
    shirt: 0x3f72d8,
    collar: 0xeaf2ff,
    glasses: true,
    hairStyle: 'short',
    browColor: '#211d29',
  },
  kid: {
    scale: 0.84,
    skin: '#ffe2c8',
    hair: 0x5c361e,
    shirt: 0xf5a623,
    collar: 0xfffbe0,
    glasses: false,
    hairStyle: 'spiky',
    browColor: '#4a2915',
  },
};

export class FamilyMember {
  constructor(seat, scene, fx) {
    this.seat = seat;
    this.role = seat.role;
    this.spec = CHAR_SPECS[this.role];
    this.fx = fx;

    this.state = 'waiting'; // waiting | sitting_need_chopsticks | eating | bliss | want_seconds
    this.expression = 'waiting';
    this.isSeated = false;
    this.sitProgress = 0; // 0 standing behind chair, 1 seated at table
    this.bounce = 0;
    this.clapTimer = 0;
    this.celebrateTimer = 0;
    this.eatTimer = 0;
    this.biteCount = 0;
    this.sipTimer = 0;
    this.emoteCooldown = 0;
    this.amazedTimer = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.lastFaceKey = '';
    this.faceTex = null;

    this.root = new THREE.Group();
    this.root.position.copy(seat.standPos);
    this.root.rotation.y = seat.faceYaw;
    scene.add(this.root);

    this.bodyGroup = new THREE.Group();
    this.bodyGroup.scale.setScalar(this.spec.scale);
    this.root.add(this.bodyGroup);

    this._buildModel();
    this._updateFace('waiting', 0, 0, 0);
  }

  _buildModel() {
    const s = this.spec;
    // Torso (rounded anime sweater/shirt)
    const torso = createToonMesh(
      new THREE.CapsuleGeometry(0.32, 0.42, 8, 14),
      s.shirt,
      { outline: 0.028 }
    );
    torso.position.y = 0.02;
    this.bodyGroup.add(torso);

    // Cute white collar / apron accent
    const collar = createToonMesh(
      new THREE.TorusGeometry(0.22, 0.055, 8, 16),
      s.collar,
      { outline: 0.018 }
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.34, 0.04);
    this.bodyGroup.add(collar);

    // Mama's cute apron strap / Papa's tie / Kid's star badge
    if (this.role === 'mama') {
      const apron = createToonMesh(new THREE.BoxGeometry(0.36, 0.44, 0.08), 0xfff8eb, {
        outline: 0.018,
      });
      apron.position.set(0, 0.02, 0.29);
      this.bodyGroup.add(apron);
    } else if (this.role === 'papa') {
      const tie = createToonMesh(new THREE.ConeGeometry(0.08, 0.36, 6), 0xffe066, {
        outline: 0.016,
      });
      tie.rotation.x = Math.PI;
      tie.position.set(0, 0.14, 0.32);
      this.bodyGroup.add(tie);
    } else {
      const badge = createToonMesh(new THREE.OctahedronGeometry(0.09, 0), 0xfff176, {
        outline: 0.016,
      });
      badge.position.set(0, 0.14, 0.32);
      this.bodyGroup.add(badge);
    }

    // Articulated Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.84, 0.04);
    this.bodyGroup.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.42, 22, 18);
    this.headMesh = createToonMesh(headGeo, new THREE.Color(s.skin), { outline: 0.032 });
    this.headGroup.add(this.headMesh);

    // Curved front face plate carrying crisp expressive comic face texture!
    // In Three.js SphereGeometry, phi=PI/2 faces +Z! Center phi around PI/2: [PI/2 - 0.36*PI, length 0.72*PI]
    const faceGeo = new THREE.SphereGeometry(
      0.428,
      20,
      16,
      Math.PI * 0.14,
      Math.PI * 0.72,
      Math.PI * 0.24,
      Math.PI * 0.56
    );
    this.faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.faceMesh = new THREE.Mesh(faceGeo, this.faceMat);
    this.headGroup.add(this.faceMesh);

    // Cute ears
    for (const dir of [-1, 1]) {
      const ear = createToonMesh(new THREE.SphereGeometry(0.088, 10, 8), new THREE.Color(s.skin), {
        outline: 0.02,
      });
      ear.position.set(dir * 0.41, -0.02, -0.02);
      this.headGroup.add(ear);
    }

    // Distinct Anime Hairstyles!
    this._buildHair(s);

    // Articulated Left & Right Arms
    this.leftArm = this._buildArm(-1, s.shirt, s.skin);
    this.rightArm = this._buildArm(1, s.shirt, s.skin);
    this.bodyGroup.add(this.leftArm);
    this.bodyGroup.add(this.rightArm);

    // Tiny eating chopsticks held in right hand (visible only while actively munching!)
    this.heldChops = new THREE.Group();
    for (const off of [-0.015, 0.015]) {
      const st = createToonMesh(new THREE.CylinderGeometry(0.01, 0.014, 0.4, 6), 0xe8b572, {
        outline: 0.008,
        castShadow: false,
      });
      st.rotation.x = Math.PI / 2;
      st.position.set(0.05 + off, -0.24, 0.42);
      this.heldChops.add(st);
    }
    this.heldChops.visible = false;
    this.rightArm.add(this.heldChops);

    // Invisible generous tap collider for petting/tapping the character directly!
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.54, 1.65, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.set(0, 0.55, 0);
    hitMesh.userData.interactKind = 'character';
    hitMesh.userData.character = this;
    this.bodyGroup.add(hitMesh);
    this.hitMesh = hitMesh;
  }

  _buildHair(s) {
    const hairMat = createToonMaterial(s.hair);
    // Smooth back-and-top hair dome positioned behind forehead so face is 100% open & readable!
    const cap = createToonMesh(
      new THREE.SphereGeometry(0.455, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      s.hair,
      { material: hairMat, outline: 0.03 }
    );
    cap.position.set(0, 0.05, -0.07);
    cap.rotation.x = -0.52;
    this.headGroup.add(cap);

    if (s.hairStyle === 'bob') {
      // Mama's chunky anime bob + bright sunny headband!
      for (const dir of [-1, 1]) {
        const side = createToonMesh(new THREE.CapsuleGeometry(0.14, 0.36, 8, 12), s.hair, {
          material: hairMat,
          outline: 0.026,
        });
        side.position.set(dir * 0.38, -0.08, -0.08);
        side.rotation.z = dir * -0.14;
        this.headGroup.add(side);
      }
      // Sculpted soft anime bangs above eyebrows
      for (const [bx, bz, sx] of [[-0.18, 0.28, 0.14], [0, 0.32, 0.16], [0.18, 0.28, 0.14]]) {
        const bang = createToonMesh(new THREE.SphereGeometry(sx, 10, 8), s.hair, {
          material: hairMat,
          outline: 0.02,
        });
        bang.scale.set(1.15, 0.55, 0.65);
        bang.position.set(bx, 0.31, bz);
        this.headGroup.add(bang);
      }

      // Sunny yellow headband
      const band = createToonMesh(new THREE.TorusGeometry(0.43, 0.048, 8, 20, Math.PI), 0xffd54f, {
        outline: 0.018,
      });
      band.position.set(0, 0.12, 0.02);
      band.rotation.x = -0.55;
      this.headGroup.add(band);
    } else if (s.hairStyle === 'short') {
      // Papa's tidy anime swept hair + ahoge tuft!
      const sweep = createToonMesh(new THREE.CapsuleGeometry(0.11, 0.34, 8, 10), s.hair, {
        material: hairMat,
        outline: 0.022,
      });
      sweep.rotation.z = Math.PI / 2 - 0.15;
      sweep.position.set(0.04, 0.34, 0.23);
      this.headGroup.add(sweep);

      const ahoge = createToonMesh(new THREE.ConeGeometry(0.075, 0.26, 8), s.hair, {
        material: hairMat,
        outline: 0.02,
      });
      ahoge.position.set(-0.08, 0.52, -0.02);
      ahoge.rotation.z = 0.32;
      this.headGroup.add(ahoge);
    } else {
      // Kid's bouncy spiky anime hair tufts high on crown!
      const spikes = [
        [-0.24, 0.42, 0.06, 0.48, 0.05],
        [0.0, 0.52, 0.02, 0.06, 0.1],
        [0.24, 0.42, 0.06, -0.48, 0.05],
        [-0.38, 0.2, -0.04, 0.85, 0.0],
        [0.38, 0.2, -0.04, -0.85, 0.0],
      ];
      for (const [x, y, z, rz, rx] of spikes) {
        const sp = createToonMesh(new THREE.ConeGeometry(0.115, 0.28, 8), s.hair, {
          material: hairMat,
          outline: 0.022,
        });
        sp.position.set(x, y, z);
        sp.rotation.set(rx, 0, rz);
        this.headGroup.add(sp);
      }
    }
  }

  _buildArm(side, shirtColor, skinHex) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.36, 0.24, 0.06);

    const sleeve = createToonMesh(new THREE.CapsuleGeometry(0.095, 0.24, 6, 10), shirtColor, {
      outline: 0.022,
    });
    sleeve.position.set(side * 0.04, -0.14, 0.1);
    sleeve.rotation.x = -0.65;
    pivot.add(sleeve);

    const hand = createToonMesh(new THREE.SphereGeometry(0.095, 10, 8), new THREE.Color(skinHex), {
      outline: 0.02,
    });
    hand.position.set(side * 0.05, -0.25, 0.24);
    pivot.add(hand);

    return pivot;
  }

  _updateFace(expression, lookX, lookY, mouthOpen) {
    // Quantize look offsets & mouth so we only repaint canvas when visibly changed!
    const qx = Math.round(lookX * 4) / 4;
    const qy = Math.round(lookY * 4) / 4;
    const qm = Math.round(mouthOpen * 3) / 3;
    const key = `${expression}_${qx}_${qy}_${qm}`;
    if (key === this.lastFaceKey) return;
    this.lastFaceKey = key;

    if (this.faceTex) this.faceTex.dispose();
    this.faceTex = createFaceTexture({
      skin: this.spec.skin,
      expression,
      glasses: this.spec.glasses,
      browColor: this.spec.browColor,
      eyeOffsetX: qx,
      eyeOffsetY: qy,
      mouthOpen: qm,
    });
    this.faceMat.map = this.faceTex;
    this.faceMat.needsUpdate = true;
  }

  reactHappy(mood = 'happy', emote = 'star') {
    this.bounce = 1.0;
    this.clapTimer = 0.9;
    if (mood === 'amazed') {
      this.amazedTimer = 1.8;
    }
    sound.playCharacterVoice(this.role, mood);
    const headWorld = new THREE.Vector3();
    this.headGroup.getWorldPosition(headWorld);
    headWorld.y += 0.55;
    this.fx.spawnEmote(headWorld, emote);
  }

  triggerCelebration() {
    this.celebrateTimer = 3.6;
    this.bounce = 1.25;
    const headWorld = new THREE.Vector3();
    this.headGroup.getWorldPosition(headWorld);
    headWorld.y += 0.6;
    this.fx.spawnBurst(headWorld, 7, 'heart', 1.3);
    this.fx.spawnEmote(headWorld.clone().add(new THREE.Vector3(0.3, 0.1, 0)), 'note');
  }

  onDirectTap() {
    this.reactHappy('happy', this.isSeated ? 'heart' : 'note');
    // If waiting for something specific, give a subtle glance/nudge toward it (handled via bounce)
  }

  getHeadWorldPos() {
    const p = new THREE.Vector3();
    this.headGroup.getWorldPosition(p);
    return p;
  }

  update(dt, time, lookTargetWorld) {
    const seat = this.seat;
    const plate = seat.plate;
    const hasFood = plate && plate.foodLevel > 0;
    const hasChop = Boolean(seat.chopsticks);
    const hasCup = Boolean(seat.cup);
    const hasDrink = hasCup && seat.cup.fillLevel > 0.18;

    // Decide whether character sits down!
    // As soon as their plate gets food, they excitedly pull up their chair and sit!
    const shouldSit = Boolean(hasFood || (plate && plate.eatenCount > 0));
    this.isSeated = shouldSit;

    const targetSit = shouldSit ? 1 : 0;
    const prevSit = this.sitProgress;
    this.sitProgress += (targetSit - this.sitProgress) * Math.min(1, dt * 6.5);
    if (prevSit < 0.5 && this.sitProgress >= 0.5) {
      sound.playCharacterVoice(this.role, 'sit');
      this.bounce = 1.0;
    }

    // Smoothly slide character & chair forward to the table!
    this.root.position.lerpVectors(seat.standPos, seat.sitPos, this.sitProgress);
    seat.chair.position.z = THREE.MathUtils.lerp(seat.chairBackZ, seat.chairSitZ, this.sitProgress);

    // Vertical sitting offset + idle breathing + joyful bounce (elevated nicely above table!)
    this.bounce = Math.max(0, this.bounce - dt * 2.6);
    const bounceY = Math.sin(this.bounce * Math.PI) * 0.24;
    const idleBob = Math.sin(time * 2.6 + seat.id * 1.9) * 0.028;
    const sitDrop = -0.09 * this.sitProgress;
    this.bodyGroup.position.y = 0.28 + sitDrop + bounceY + idleBob;

    // Timers
    if (this.clapTimer > 0) this.clapTimer = Math.max(0, this.clapTimer - dt);
    if (this.celebrateTimer > 0) this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);
    if (this.amazedTimer > 0) this.amazedTimer = Math.max(0, this.amazedTimer - dt);
    if (this.emoteCooldown > 0) this.emoteCooldown = Math.max(0, this.emoteCooldown - dt);

    // Eating & sipping logic when seated with food!
    let expression = 'waiting';
    let mouthOpen = 0;
    this.heldChops.visible = false;

    // Tilt head slightly upward (-0.24 rad) so adorable anime faces shine straight at the player!
    const baseTiltX = -0.24;

    if (this.celebrateTimer > 0) {
      expression = 'bliss';
      this.leftArm.rotation.set(-2.2 + Math.sin(time * 12 + seat.id) * 0.35, 0, -0.35);
      this.rightArm.rotation.set(-2.2 + Math.cos(time * 12 + seat.id) * 0.35, 0, 0.35);
      this.headGroup.rotation.x = baseTiltX - 0.06;
      this.headGroup.rotation.z = Math.sin(time * 7 + seat.id) * 0.14;
      if (this.emoteCooldown <= 0) {
        this.emoteCooldown = 0.65;
        const hp = this.getHeadWorldPos();
        hp.y += 0.55;
        this.fx.spawnEmote(hp, Math.random() > 0.5 ? 'heart' : 'star');
      }
    } else if (this.amazedTimer > 0) {
      expression = 'amazed';
      this.leftArm.rotation.set(-1.3, 0, -0.25);
      this.rightArm.rotation.set(-1.3, 0, 0.25);
      this.headGroup.rotation.x = baseTiltX - 0.04;
      this.headGroup.rotation.z = Math.sin(time * 14) * 0.08;
    } else if (this.isSeated && hasFood && hasChop) {
      // Happily eating!
      this.eatTimer += dt;
      const cycle = this.eatTimer % 2.4;
      if (this.sipTimer > 0) {
        // Taking a refreshing sip!
        this.sipTimer -= dt;
        expression = 'sipping';
        this.rightArm.rotation.set(-1.15, 0, 0.15);
        this.leftArm.rotation.set(-0.2, 0, 0);
        this.headGroup.rotation.x = baseTiltX - 0.12;
      } else if (cycle < 1.35) {
        // Mogu-mogu chewing with held chopsticks!
        expression = plate.sprinkled ? 'bliss' : 'eating';
        this.heldChops.visible = true;
        mouthOpen = (Math.sin(time * 18) + 1) * 0.5;
        this.rightArm.rotation.set(-0.85 + Math.sin(time * 9) * 0.25, -0.25, 0.15);
        this.leftArm.rotation.set(-0.35, 0.15, -0.1);
        this.headGroup.rotation.x = baseTiltX + 0.06 + Math.sin(time * 9) * 0.05;
        this.headGroup.rotation.z = Math.sin(time * 4.5 + seat.id) * 0.08;

        // Bite tick every ~2.4s to visibly eat down food (and ask for seconds!)
        if (Math.floor((this.eatTimer - dt) / 2.4) < Math.floor(this.eatTimer / 2.4)) {
          sound.playMunch(this.role);
          if (plate.sprinkled || Math.random() < 0.65) {
            const hp = this.getHeadWorldPos();
            hp.y += 0.52;
            this.fx.spawnEmote(hp, plate.sprinkled ? 'heart' : 'note');
          }
          // Gradually consume bites (each scoop gives 3 happy bites so they enjoy it richly!)
          plate.consumeBite();
          this.biteCount++;
          // Occasionally take a refreshing drink between bites if cup has liquid!
          if (hasDrink && this.biteCount % 2 === 0) {
            this.sipTimer = 0.95;
            seat.cup.sip(0.22);
            sound.playGulp(this.role);
          }
        }
      } else {
        // Happy smile between bites
        expression = 'excited';
        this.heldChops.visible = true;
        this.rightArm.rotation.set(-0.55, -0.15, 0.1);
        this.leftArm.rotation.set(-0.25, 0.1, -0.05);
        this.headGroup.rotation.x = baseTiltX;
        this.headGroup.rotation.z = Math.sin(time * 3 + seat.id) * 0.06;
      }
    } else if (this.isSeated && hasFood && !hasChop) {
      // Seated & smelling delicious food, glancing eagerly at the empty chopstick rest!
      expression = 'excited';
      // Playful finger-tapping waiting gesture
      this.leftArm.rotation.set(-0.55 + Math.sin(time * 8) * 0.14, 0, -0.1);
      this.rightArm.rotation.set(-0.55 + Math.cos(time * 8) * 0.14, 0, 0.1);
      this.headGroup.rotation.x = baseTiltX + 0.1;
      this.headGroup.rotation.z = Math.sin(time * 3.5) * 0.07;
    } else if (this.isSeated && !hasFood) {
      // Finished bowl — happily asking for seconds (おかわり!)
      expression = 'excited';
      this.leftArm.rotation.set(-0.9 + Math.sin(time * 5 + seat.id) * 0.15, 0.2, -0.15);
      this.rightArm.rotation.set(-0.9 + Math.sin(time * 5 + seat.id) * 0.15, -0.2, 0.15);
      this.headGroup.rotation.x = baseTiltX;
      this.headGroup.rotation.z = Math.sin(time * 4 + seat.id) * 0.09;
    } else if (this.clapTimer > 0) {
      // Happy clapping when tableware arrives!
      expression = 'excited';
      const clap = Math.sin(time * 22) * 0.32;
      this.leftArm.rotation.set(-1.1, 0.55 + clap, -0.15);
      this.rightArm.rotation.set(-1.1, -0.55 - clap, 0.15);
      this.headGroup.rotation.x = baseTiltX;
      this.headGroup.rotation.z = Math.sin(time * 10) * 0.09;
    } else {
      // Waiting cheerfully behind chair, glancing at what player is holding
      expression = plate ? 'excited' : 'waiting';
      this.leftArm.rotation.set(-0.18 + Math.sin(time * 2.2 + seat.id) * 0.08, 0, -0.06);
      this.rightArm.rotation.set(-0.18 + Math.cos(time * 2.2 + seat.id) * 0.08, 0, 0.06);
      this.headGroup.rotation.x = baseTiltX;
      this.headGroup.rotation.z = Math.sin(time * 2.0 + seat.id) * 0.04;
    }

    // Eye & subtle head yaw tracking toward dragged item (or own seat)
    const target = lookTargetWorld || seat.plateSpot;
    const hp = this.getHeadWorldPos();
    const dx = target.x - hp.x;
    const dz = Math.max(0.5, target.z - hp.z);
    const relYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) - seat.faceYaw, -0.45, 0.45);
    this.headGroup.rotation.y += (relYaw * 0.65 - this.headGroup.rotation.y) * Math.min(1, dt * 8);

    const targetLookX = THREE.MathUtils.clamp(relYaw * 1.8, -1, 1);
    const targetLookY = THREE.MathUtils.clamp((hp.y - target.y) * 0.32, -0.6, 0.85);
    this.lookX += (targetLookX - this.lookX) * Math.min(1, dt * 10);
    this.lookY += (targetLookY - this.lookY) * Math.min(1, dt * 10);

    this._updateFace(expression, this.lookX, this.lookY, mouthOpen);
  }
}
