import * as THREE from 'three';
import { createCeramicTexture, createBirchWoodTexture } from './textures.js';

const FAMILY_SPECS = [
  {
    id: 'papa',
    plateColor: '#4e6f91',
    bodyColor: '#36526d',
    collarColor: '#e8dfd1',
    hairColor: '#4c3221',
    height: 1.02,
    radius: 0.23,
    hairStyle: 'cap',
    favorites: ['mushroom', 'basil', 'pepperoni'],
    seed: 101
  },
  {
    id: 'mama',
    plateColor: '#c96f5b',
    bodyColor: '#b55946',
    collarColor: '#f4ebde',
    hairColor: '#5e3b24',
    height: 0.92,
    radius: 0.21,
    hairStyle: 'bun',
    favorites: ['tomato', 'basil', 'cheese'],
    seed: 202
  },
  {
    id: 'sister',
    plateColor: '#769a77',
    bodyColor: '#5e8560',
    collarColor: '#f6efe4',
    hairColor: '#4a2e1d',
    height: 0.74,
    radius: 0.185,
    hairStyle: 'pigtails',
    favorites: ['cheese', 'pepperoni', 'tomato'],
    seed: 303
  },
  {
    id: 'brother',
    plateColor: '#d9a448',
    bodyColor: '#cc8f32',
    collarColor: '#f4ead8',
    hairColor: '#583923',
    height: 0.62,
    radius: 0.17,
    hairStyle: 'tuft',
    favorites: ['corn', 'cheese'],
    seed: 404
  }
];

export function createFamily(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const birchTex = createBirchWoodTexture();
  const birchMat = new THREE.MeshStandardMaterial({
    map: birchTex,
    roughness: 0.52,
    metalness: 0.02
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.3 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe27d70, roughness: 0.75 });
  const spoonMat = new THREE.MeshStandardMaterial({ color: 0xc99a64, roughness: 0.65 });

  // Stoneware plate geometry (subtle raised rim, flat glossy center)
  const platePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.36, 0),
    new THREE.Vector2(0.5, 0.055),
    new THREE.Vector2(0.54, 0.095),
    new THREE.Vector2(0.5, 0.1),
    new THREE.Vector2(0.39, 0.045),
    new THREE.Vector2(0, 0.04)
  ];
  const plateGeo = new THREE.LatheGeometry(platePts, 28);

  const members = [];

  for (let i = 0; i < FAMILY_SPECS.length; i++) {
    const spec = FAMILY_SPECS[i];
    const seatGroup = new THREE.Group();
    seatGroup.visible = false;
    group.add(seatGroup);

    // Glazed Stoneware Plate
    const plateMat = new THREE.MeshStandardMaterial({
      map: createCeramicTexture(spec.plateColor, spec.seed),
      roughness: 0.28,
      metalness: 0.05
    });
    const plateGroup = new THREE.Group();
    seatGroup.add(plateGroup);

    // Woven round natural linen placemat under each stoneware plate
    const matMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.61, 0.012, 28),
      new THREE.MeshStandardMaterial({ color: 0xeadcc7, roughness: 0.94 })
    );
    matMesh.position.y = 0.006;
    matMesh.receiveShadow = true;
    plateGroup.add(matMesh);

    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.y = 0.012;
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    plateGroup.add(plateMesh);

    // Subtle cream inner glaze ring on plate for artisan pottery realism
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.37, 28),
      new THREE.MeshBasicMaterial({ color: 0xf4ead8, transparent: true, opacity: 0.45 })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.056;
    plateGroup.add(innerRing);

    // Slice holder right on top of the plate
    const sliceHolder = new THREE.Group();
    sliceHolder.position.set(0, 0.06, 0);
    plateGroup.add(sliceHolder);

    // Hand-turned Birch Wood Peg Doll Figurine behind the plate
    const dollGroup = new THREE.Group();
    seatGroup.add(dollGroup);

    const bodyH = spec.height * 0.62;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: spec.bodyColor,
      roughness: 0.72,
      metalness: 0.02
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius * 0.68, spec.radius * 1.05, bodyH, 20),
      bodyMat
    );
    body.position.y = bodyH * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    dollGroup.add(body);

    // Soft painted waist band / apron accent for handcrafted miniature toy warmth
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius * 0.85, spec.radius * 0.94, bodyH * 0.22, 20),
      new THREE.MeshStandardMaterial({ color: spec.collarColor, roughness: 0.86 })
    );
    band.position.y = bodyH * 0.44;
    dollGroup.add(band);

    // Soft woven collar around neck
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius * 0.62, 0.036, 8, 18),
      new THREE.MeshStandardMaterial({ color: spec.collarColor, roughness: 0.88 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = bodyH + 0.01;
    dollGroup.add(collar);

    // Head pivot (turns & leans eagerly toward the pizza!)
    const headPivot = new THREE.Group();
    headPivot.position.y = bodyH + spec.radius * 0.82;
    dollGroup.add(headPivot);

    const headR = spec.radius * 0.88;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 16), birchMat);
    head.castShadow = true;
    headPivot.add(head);

    // Tiny painted bead eyes + rosy cheeks + friendly painted wooden smile!
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), eyeMat);
      eye.position.set(side * headR * 0.34, headR * 0.08, headR * 0.88);
      headPivot.add(eye);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), cheekMat);
      cheek.scale.set(1.2, 0.75, 0.4);
      cheek.position.set(side * headR * 0.56, -headR * 0.14, headR * 0.78);
      headPivot.add(cheek);
    });
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(headR * 0.22, 0.0085, 6, 12, Math.PI),
      eyeMat
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, -headR * 0.14, headR * 0.91);
    headPivot.add(smile);

    // Hair details sculpted in painted wood
    const hairMat = new THREE.MeshStandardMaterial({ color: spec.hairColor, roughness: 0.72 });
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      hairMat
    );
    hairCap.rotation.x = -0.22;
    hairCap.position.y = 0.01;
    headPivot.add(hairCap);

    if (spec.hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.48, 14, 10), hairMat);
      bun.position.set(0, headR * 0.92, -headR * 0.35);
      headPivot.add(bun);
    } else if (spec.hairStyle === 'pigtails') {
      [-1, 1].forEach((side) => {
        const tail = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.42, 12, 10), hairMat);
        tail.position.set(side * headR * 0.95, headR * 0.25, -headR * 0.12);
        headPivot.add(tail);
      });
    } else if (spec.hairStyle === 'tuft') {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.28, headR * 0.48, 8), hairMat);
      tuft.position.set(0.02, headR * 1.08, 0.04);
      tuft.rotation.z = -0.25;
      headPivot.add(tuft);
    }

    // Tiny wooden fork/spoon held eagerly on the right side
    const utensil = new THREE.Group();
    utensil.position.set(spec.radius * 0.95, bodyH * 0.55, spec.radius * 0.45);
    dollGroup.add(utensil);
    const uStick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.32, 8), spoonMat);
    uStick.rotation.x = 0.45;
    utensil.add(uStick);
    const uHead = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), spoonMat);
    uHead.scale.set(0.9, 1.3, 0.45);
    uHead.position.set(0, 0.16, 0.075);
    utensil.add(uHead);

    members.push({
      index: i,
      spec,
      seatGroup,
      plateGroup,
      sliceHolder,
      dollGroup,
      headPivot,
      utensil,
      plateWorldPos: new THREE.Vector3(),
      dollOffset: new THREE.Vector3(),
      appearScale: 0,
      servedCount: 0,
      eatingSlice: null,
      eatTimer: 0,
      bitesTaken: 0,
      happyTimer: 0,
      extraHappy: false,
      wobble: 0
    });
  }

  // --- Fresh Dough Ball Side Tray (physical zero-text "Make Another Pizza!" toy) ---
  const nextDoughTray = new THREE.Group();
  nextDoughTray.visible = false;
  group.add(nextDoughTray);

  const trayMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.45, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0xb98552, roughness: 0.72 })
  );
  trayMesh.position.y = 0.03;
  trayMesh.castShadow = true;
  trayMesh.receiveShadow = true;
  nextDoughTray.add(trayMesh);

  const nextDoughBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xf5e8cf, roughness: 0.92 })
  );
  nextDoughBall.scale.set(1, 0.68, 1);
  nextDoughBall.position.y = 0.22;
  nextDoughBall.castShadow = true;
  nextDoughTray.add(nextDoughBall);

  let visibleActive = false;
  let showNextTray = false;
  let trayTargetPos = new THREE.Vector3(2.35, 0, 1.35);

  return {
    group,
    members,
    nextDoughTray,
    setVisible(active, isPortrait) {
      visibleActive = active;
      this.layout(isPortrait);
      if (active) {
        for (const m of members) m.seatGroup.visible = true;
      }
    },
    setShowNextTray(show, isPortrait) {
      showNextTray = show;
      if (show) nextDoughTray.visible = true;
      trayTargetPos.set(isPortrait ? 1.48 : 2.35, 0, isPortrait ? 2.15 : 1.35);
    },
    layout(isPortrait) {
      // Positioned cleanly in a cozy dining arc behind the cutting board & in front of the glowing brick oven!
      const positions = isPortrait
        ? [
            { px: -1.16, pz: -0.78, dx: -0.14, dz: -0.62 },
            { px: -0.4, pz: -1.18, dx: -0.05, dz: -0.64 },
            { px: 0.4, pz: -1.18, dx: 0.05, dz: -0.64 },
            { px: 1.16, pz: -0.78, dx: 0.14, dz: -0.62 }
          ]
        : [
            { px: -1.86, pz: -0.32, dx: -0.22, dz: -0.62 },
            { px: -0.66, pz: -1.04, dx: -0.08, dz: -0.66 },
            { px: 0.66, pz: -1.04, dx: 0.08, dz: -0.66 },
            { px: 1.86, pz: -0.32, dx: 0.22, dz: -0.62 }
          ];

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const p = positions[i];
        m.plateWorldPos.set(p.px, 0.025, p.pz);
        m.plateGroup.position.set(p.px, 0.025, p.pz);
        m.dollGroup.position.set(p.px + p.dx, 0.015, p.pz + p.dz);
        // Face gently toward the center cutting board at (0, 0, 0.92)
        m.dollGroup.lookAt(0, 0.015, 0.92);
      }
      trayTargetPos.set(isPortrait ? 1.48 : 2.35, 0, isPortrait ? 2.15 : 1.35);
    },
    resetForNewPizza() {
      visibleActive = false;
      showNextTray = false;
      nextDoughTray.visible = false;
      for (const m of members) {
        m.servedCount = 0;
        m.eatingSlice = null;
        m.eatTimer = 0;
        m.bitesTaken = 0;
        m.happyTimer = 0;
        m.extraHappy = false;
        m.appearScale = 0;
        m.seatGroup.visible = false;
        while (m.sliceHolder.children.length > 0) {
          m.sliceHolder.remove(m.sliceHolder.children[0]);
        }
      }
    },
    serveSliceToMember(memberIdx, sliceData, onBite, onFinish) {
      const m = members[memberIdx];
      if (!m) return;

      // Clear any previous leftover on plate cleanly
      while (m.sliceHolder.children.length > 0) {
        m.sliceHolder.remove(m.sliceHolder.children[0]);
      }

      // Attach the physical slice (with all the child's exact toppings!) centered nicely on the plate
      const sGrp = sliceData.group;
      if (sGrp.parent) sGrp.parent.remove(sGrp);

      // Offset slice so its centroid (~0.56 along midAngle) sits right in the middle of the ceramic plate!
      const cDist = 0.56;
      const pivot = new THREE.Group();
      sGrp.position.set(-Math.cos(sliceData.midAngle) * cDist, 0, -Math.sin(sliceData.midAngle) * cDist);
      sGrp.rotation.set(0, 0, 0);
      pivot.add(sGrp);
      pivot.scale.setScalar(0.84);
      pivot.rotation.y = Math.random() * 0.5 - 0.25;
      m.sliceHolder.add(pivot);

      // Check if slice has one of this family member's favorite toppings!
      let hasFav = false;
      for (const fav of m.spec.favorites) {
        if ((sliceData.toppings[fav] || 0) > 0) {
          hasFav = true;
          break;
        }
      }

      m.servedCount++;
      m.eatingSlice = pivot;
      m.eatTimer = 0;
      m.bitesTaken = 0;
      m.extraHappy = hasFav;
      m.happyTimer = 2.4;
      m.onBite = onBite;
      m.onFinish = onFinish;
    },
    allMembersServed() {
      return members.every((m) => m.servedCount > 0);
    },
    findClosestPlate(worldPos, maxRadius = 0.92) {
      let best = -1;
      let bestDist = maxRadius;
      for (let i = 0; i < members.length; i++) {
        const d = Math.hypot(
          worldPos.x - members[i].plateWorldPos.x,
          worldPos.z - members[i].plateWorldPos.z
        );
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    findClosestDoll(worldPos, maxRadius = 0.65) {
      let best = -1;
      let bestDist = maxRadius;
      for (let i = 0; i < members.length; i++) {
        const d = Math.hypot(
          worldPos.x - members[i].dollGroup.position.x,
          worldPos.z - members[i].dollGroup.position.z
        );
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    update(dt, elapsed, lookTargetWorld = null) {
      const k = 1 - Math.exp(-dt * 7.5);
      for (const m of members) {
        const targetS = visibleActive ? 1 : 0;
        m.appearScale = THREE.MathUtils.lerp(m.appearScale, targetS, k);
        if (!visibleActive && m.appearScale < 0.02) {
          m.seatGroup.visible = false;
          continue;
        }
        m.seatGroup.scale.setScalar(Math.max(0.001, m.appearScale));

        // Eager gentle breathing & fork tap while waiting for pizza!
        const waiting = m.servedCount === 0 && !m.eatingSlice;
        const eagerTap = waiting ? Math.sin(elapsed * 4.5 + m.index * 1.4) : 0;
        m.utensil.rotation.x = 0.15 + Math.max(0, eagerTap) * 0.28;

        // Expressive head tracking toward any lifted slice!
        if (lookTargetWorld && !m.eatingSlice) {
          const dx = lookTargetWorld.x - m.dollGroup.position.x;
          const dz = lookTargetWorld.z - m.dollGroup.position.z;
          const targetYaw = Math.atan2(dx, dz) - m.dollGroup.rotation.y;
          const clampedYaw = THREE.MathUtils.clamp(
            Math.atan2(Math.sin(targetYaw), Math.cos(targetYaw)),
            -0.55,
            0.55
          );
          m.headPivot.rotation.y = THREE.MathUtils.lerp(m.headPivot.rotation.y, clampedYaw, k);
          m.headPivot.rotation.x = THREE.MathUtils.lerp(m.headPivot.rotation.x, 0.12, k);
        } else {
          m.headPivot.rotation.y = THREE.MathUtils.lerp(m.headPivot.rotation.y, 0, k);
          m.headPivot.rotation.x = THREE.MathUtils.lerp(m.headPivot.rotation.x, 0, k);
        }

        // Bite-by-bite joyful eating animation!
        if (m.eatingSlice) {
          m.eatTimer += dt;
          const biteStep = Math.floor(m.eatTimer / 0.48);
          // Lean forward eagerly to nibble!
          const chew = Math.abs(Math.sin(m.eatTimer * 13));
          m.dollGroup.rotation.x = 0.26 + chew * 0.12;
          m.dollGroup.position.y = chew * 0.04;

          if (biteStep > m.bitesTaken && m.bitesTaken < 3) {
            m.bitesTaken++;
            const remain = Math.max(0, 1 - m.bitesTaken * 0.34);
            if (remain <= 0.05) {
              m.sliceHolder.remove(m.eatingSlice);
              m.eatingSlice = null;
              m.happyTimer = m.extraHappy ? 2.6 : 1.8;
              if (m.onFinish) m.onFinish(m);
            } else {
              m.eatingSlice.scale.setScalar(0.84 * remain);
              m.eatingSlice.rotation.y += 0.35;
              if (m.onBite) m.onBite(m);
            }
          }
        } else if (m.happyTimer > 0) {
          m.happyTimer = Math.max(0, m.happyTimer - dt);
          const speed = m.extraHappy ? 15 : 10.5;
          const hop = Math.abs(Math.sin(m.happyTimer * speed)) * Math.min(1, m.happyTimer);
          m.dollGroup.position.y = hop * (m.extraHappy ? 0.22 : 0.13);
          m.dollGroup.rotation.x = 0;
          m.dollGroup.rotation.z = Math.sin(m.happyTimer * speed * 0.6) * 0.14 * Math.min(1, m.happyTimer);
        } else {
          m.dollGroup.position.y = THREE.MathUtils.lerp(m.dollGroup.position.y, 0, k);
          m.dollGroup.rotation.x = THREE.MathUtils.lerp(m.dollGroup.rotation.x, 0, k);
          m.dollGroup.rotation.z = THREE.MathUtils.lerp(m.dollGroup.rotation.z, 0, k);
        }
      }

      // Fresh dough ball replay tray gently bobs when available
      if (nextDoughTray.visible) {
        const sTarget = showNextTray ? 1 : 0;
        const curS = THREE.MathUtils.lerp(nextDoughTray.scale.x, sTarget, k);
        nextDoughTray.scale.setScalar(Math.max(0.001, curS));
        nextDoughTray.position.lerp(trayTargetPos, k);
        nextDoughBall.position.y = 0.22 + Math.abs(Math.sin(elapsed * 2.8)) * 0.04;
      }
    }
  };
}
