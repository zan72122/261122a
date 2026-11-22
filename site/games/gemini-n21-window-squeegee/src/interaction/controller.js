import * as THREE from 'three';

/**
 * Effortless 1-finger wordless interaction controller for a 5-year-old child.
 * - Zero text, zero UI buttons, zero arrows: the real physical tools on the oak sill ARE the interface!
 * - Touching the spray bottle lifts it into the first-person hand; tapping or dragging on glass sprays foamy bursts.
 * - Touching the squeegee lifts it into hand; dragging on glass presses the rubber blade flush and wipes crystal clear!
 * - Touching foggy glass directly with NO tool held draws squeaky bare-finger trails through the condensation!
 * - Every other sill object (potted plant, steaming teacup, crystal suncatcher) responds physically to touch!
 */
export class InteractionController {
  constructor({ domElement, camera, room, glass, props, hand, particles, sound }) {
    this.dom = domElement;
    this.camera = camera;
    this.room = room;
    this.glass = glass;
    this.props = props;
    this.hand = hand;
    this.particles = particles;
    this.sound = sound;

    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.activePointerId = null;

    // Active tool: 'none' | 'spray' | 'squeegee'
    this.activeTool = 'none';
    this.isPressingGlass = false;
    this.draggingPickedTool = false;
    this.lastUv = null;
    this.currUv = null;

    // Smooth target transforms for held tool
    this.aimWorld = new THREE.Vector3(0, room.PANE_CY, 0.0);
    this.smoothedAim = new THREE.Vector3(0, room.PANE_CY, 0.0);
    this.bladeAngle = 0; // radians in XY glass plane (0 = horizontal rubber blade)
    this.targetBladeAngle = 0;
    this.squeezeAnim = 0;
    this.sprayCooldown = 0;
    this.plowFoamLoad = 0;
    this.celebratedClean = false;
    this.idleSeconds = 0;

    // Plane coinciding with the front face of the glass pane (Z = 0.008)
    this.glassPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.008);
    this._tmpVec = new THREE.Vector3();
    this._tmpNozzle = new THREE.Vector3();

    // Bind single-finger resilient pointer listeners
    this._onDown = this._handlePointerDown.bind(this);
    this._onMove = this._handlePointerMove.bind(this);
    this._onUp = this._handlePointerUp.bind(this);

    domElement.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
  }

  _updateNDC(e) {
    const rect = this.dom.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _raycastProps(ignorePropId = null) {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects([this.props.root], true);
    for (const h of hits) {
      let obj = h.object;
      while (obj) {
        if (obj.userData && obj.userData.propId) {
          if (obj.userData.propId === ignorePropId) break;
          return { propId: obj.userData.propId, point: h.point };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  _raycastGlass() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.glassPlane, this._tmpVec);
    if (!hit) return null;
    const u = (hit.x / this.room.PANE_W) + 0.5;
    const v = ((hit.y - this.room.PANE_CY) / this.room.PANE_H) + 0.5;
    const inPane = u >= -0.04 && u <= 1.04 && v >= -0.04 && v <= 1.04;
    return {
      inPane,
      u: Math.max(0.0, Math.min(1.0, u)),
      v: Math.max(0.0, Math.min(1.0, v)),
      world: hit.clone(),
    };
  }

  selectTool(toolName) {
    if (this.activeTool === toolName) return;
    this.activeTool = toolName;
    this.sound.playWoodTap(toolName === 'none' ? 0.88 : 1.12);
    this.idleSeconds = 0;
  }

  _handlePointerDown(e) {
    e.preventDefault();
    this.sound.unlock();
    // Ignore secondary fingers while one finger is actively interacting
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
    this.activePointerId = e.pointerId;
    this.idleSeconds = 0;
    this._updateNDC(e);

    // 1. Check if the child tapped a physical prop on the sill or hanging prism
    //    (Ignore the currently held tool so touching the glass near your hand never accidentally drops it!)
    const propHit = this._raycastProps(this.activeTool !== 'none' ? this.activeTool : null);
    if (propHit) {
      const id = propHit.propId;
      if (id === 'spray') {
        this.selectTool('spray');
        this.draggingPickedTool = true;
        return;
      }
      if (id === 'squeegee') {
        this.selectTool('squeegee');
        this.draggingPickedTool = true;
        return;
      }
      if (id === 'plant') {
        this.props.triggerPlantRustle(1.0);
        this.sound.playPlantRustle();
        if (this.activeTool === 'spray') {
          this.squeezeAnim = 1.0;
          this.sound.playSprayBurst();
          this.particles.emitSparkleDrops(propHit.point, 12);
        }
        return;
      }
      if (id === 'cup') {
        this.props.triggerSteamBurst();
        this.sound.playTeacupSteam();
        this.glass.addSteamWave(0.82, 0.14, 1.0);
        this.celebratedClean = false;
        return;
      }
      if (id === 'prism') {
        this.props.triggerPrismSwing(1.2);
        this.sound.playCrystalChime(1.0);
        // Only swallow tap if bare-handed; while spraying or squeegeeing, let the tool keep cleaning the glass behind it!
        if (this.activeTool === 'none') return;
      }
    }

    // 2. Check interaction on the large window glass
    const gHit = this._raycastGlass();
    if (gHit && gHit.inPane) {
      this.isPressingGlass = true;
      this.aimWorld.copy(gHit.world);
      this.currUv = { u: gHit.u, v: gHit.v };
      this.lastUv = { u: gHit.u, v: gHit.v };

      if (this.activeTool === 'spray') {
        this._fireSprayAt(gHit.u, gHit.v, gHit.world);
      } else if (this.activeTool === 'squeegee') {
        const res = this.glass.wipeSqueegee(gHit.u, gHit.v, gHit.u, gHit.v, this.bladeAngle);
        this.plowFoamLoad = Math.min(1, this.plowFoamLoad + res.pushedFoam * 0.6);
      } else {
        const st = this.glass.getPixelState(gHit.u, gHit.v);
        if (st.fog > 0.12 || st.foam > 0.08) {
          this.glass.wipeBareFinger(gHit.u, gHit.v, gHit.u, gHit.v);
          this.sound.playFingerSqueak(0.35);
        } else {
          this.sound.playGlassTap();
          this.props.triggerPrismSwing(0.28);
        }
      }
    } else if (this.activeTool !== 'none' && this.pointerNDC.y < -0.52) {
      // Tapping the empty oak sill sets the held tool gently back down!
      this.selectTool('none');
    }
  }

  _handlePointerMove(e) {
    if (this.activePointerId !== e.pointerId) return;
    e.preventDefault();
    this.idleSeconds = 0;
    this._updateNDC(e);

    // Seamless 1-finger drag straight off the oak sill onto the glass!
    if (this.draggingPickedTool && !this.isPressingGlass) {
      const gHit = this._raycastGlass();
      if (gHit && gHit.inPane) {
        this.isPressingGlass = true;
        this.aimWorld.copy(gHit.world);
        this.lastUv = { u: gHit.u, v: gHit.v };
        this.currUv = { u: gHit.u, v: gHit.v };
        if (this.activeTool === 'spray' && this.sprayCooldown <= 0) {
          this._fireSprayAt(gHit.u, gHit.v, gHit.world);
        }
      }
      return;
    }

    if (!this.isPressingGlass) return;
    const gHit = this._raycastGlass();
    if (!gHit || !gHit.inPane) return;

    const prevWorld = this.aimWorld.clone();
    this.aimWorld.copy(gHit.world);
    const moveVec = new THREE.Vector3().subVectors(gHit.world, prevWorld);
    const distMeters = moveVec.length();

    if (this.activeTool === 'spray') {
      if (this.sprayCooldown <= 0 && distMeters > 0.012) {
        this._fireSprayAt(gHit.u, gHit.v, gHit.world);
      }
    } else if (this.activeTool === 'squeegee') {
      if (this.lastUv) {
        // Orient blade naturally perpendicular to primary drag motion (with gentle limits so handle stays comfortable)
        if (distMeters > 0.006) {
          const moveAng = Math.atan2(moveVec.y, moveVec.x);
          // Blade perpendicular to drag, kept within +-55 deg of horizontal for ergonomic realistic wiping
          let desired = moveAng + Math.PI * 0.5;
          while (desired > Math.PI * 0.5) desired -= Math.PI;
          while (desired < -Math.PI * 0.5) desired += Math.PI;
          this.targetBladeAngle = THREE.MathUtils.clamp(desired, -0.92, 0.92);
        }
        const res = this.glass.wipeSqueegee(
          this.lastUv.u, this.lastUv.v, gHit.u, gHit.v, this.bladeAngle
        );
        const speed = Math.min(2.5, distMeters * 45);
        this.sound.setSqueegeeMotion(speed, res.isWet, res.pushedFoam > 0.08);
        this.plowFoamLoad = Math.min(1, Math.max(this.plowFoamLoad * 0.94, res.pushedFoam * 2.2));
      }
    } else {
      // Bare-finger condensation trail
      if (this.lastUv && distMeters > 0.002) {
        const cleared = this.glass.wipeBareFinger(this.lastUv.u, this.lastUv.v, gHit.u, gHit.v);
        if (cleared > 0.02) {
          this.sound.playFingerSqueak(distMeters * 40);
        }
      }
    }

    this.lastUv = { u: gHit.u, v: gHit.v };
    this.currUv = { u: gHit.u, v: gHit.v };
  }

  _handlePointerUp(e) {
    if (this.activePointerId !== e.pointerId) return;
    this.activePointerId = null;
    this.isPressingGlass = false;
    this.draggingPickedTool = false;
    this.lastUv = null;
    this.sound.setSqueegeeMotion(0, false, false);
  }

  _fireSprayAt(u, v, worldTarget) {
    this.sprayCooldown = 0.21;
    this.squeezeAnim = 1.0;
    this.glass.sprayFoam(u, v, 1.0);
    this.sound.playSprayBurst();

    this.props.nozzleTip.getWorldPosition(this._tmpNozzle);
    this.particles.emitSprayBurst(this._tmpNozzle, worldTarget);
  }

  /** Programmatic demo/verification helper for screenshots */
  runDemoAction(type, opts = {}) {
    if (type === 'select') {
      this.activeTool = opts.tool || 'none';
      if (opts.aim) this.aimWorld.set(opts.aim[0], opts.aim[1], 0.01);
      this.smoothedAim.copy(this.aimWorld);
      this.isPressingGlass = !!opts.pressing;
    } else if (type === 'spray') {
      this.glass.sprayFoam(opts.u ?? 0.5, opts.v ?? 0.55, opts.intensity ?? 1.0);
    } else if (type === 'wipe') {
      this.glass.wipeSqueegee(
        opts.u0 ?? 0.2, opts.v0 ?? 0.8,
        opts.u1 ?? 0.2, opts.v1 ?? 0.2,
        opts.angle ?? 0
      );
    } else if (type === 'cleanAll') {
      for (const x of [0.05, 0.18, 0.31, 0.44, 0.57, 0.70, 0.83, 0.95]) {
        this.glass.wipeSqueegee(x, 0.99, x, 0.01, 0);
      }
      this.glass._recomputeStats();
    } else if (type === 'reset') {
      this.glass.resetToMorningFog(opts.seed || 0);
      this.activeTool = 'none';
      this.isPressingGlass = false;
    }
  }

  update(dt, elapsed) {
    this.idleSeconds += dt;
    if (this.sprayCooldown > 0) this.sprayCooldown = Math.max(0, this.sprayCooldown - dt);
    if (this.squeezeAnim > 0) this.squeezeAnim = Math.max(0, this.squeezeAnim - dt * 5.2);
    if (!this.isPressingGlass) {
      this.plowFoamLoad *= Math.exp(-dt * 4.5);
    }

    // Smoothly track aim point & blade rotation
    this.smoothedAim.lerp(this.aimWorld, Math.min(1, dt * 18));
    this.bladeAngle += (this.targetBladeAngle - this.bladeAngle) * Math.min(1, dt * 14);

    // Subtle celebratory crystal shimmer the first time the window reaches >82% crystal clarity!
    if (!this.celebratedClean && this.glass.cleanRatio > 0.82) {
      this.celebratedClean = true;
      this.props.triggerPrismSwing(1.35);
      this.sound.playCrystalChime(1.1);
    }

    // Gentle, wordless physical invitation ONLY if untouched for >9 seconds (per wordless.short.md)
    let sprayIdleWiggle = 0;
    let squeegeeIdleWiggle = 0;
    if (this.idleSeconds > 9.0 && this.activeTool === 'none') {
      const pulse = Math.max(0, Math.sin((this.idleSeconds - 9.0) * 1.4));
      if (this.glass.foamCoverage < 0.06 && this.glass.cleanRatio < 0.7) {
        sprayIdleWiggle = Math.sin(elapsed * 9.0) * 0.045 * Math.pow(pulse, 4);
      } else if (this.glass.cleanRatio < 0.78) {
        squeegeeIdleWiggle = Math.sin(elapsed * 8.0) * 0.04 * Math.pow(pulse, 4);
      }
    }

    const lerpRate = Math.min(1, dt * 11);

    // Animate hinged trigger pull on spray bottle!
    if (this.props.triggerPivot) {
      this.props.triggerPivot.rotation.x = this.squeezeAnim * 0.42;
    }

    // --- 1. SPRAY BOTTLE POSITIONING ---
    if (this.activeTool === 'spray') {
      const holdX = THREE.MathUtils.clamp(this.smoothedAim.x + 0.07, -0.50, 0.54);
      const holdY = THREE.MathUtils.clamp(this.smoothedAim.y - 0.18, this.room.SILL_Y + 0.04, 1.50);
      const holdZ = 0.28 - this.squeezeAnim * 0.012;
      this.props.sprayGroup.position.lerp(new THREE.Vector3(holdX, holdY, holdZ), lerpRate);
      const pitchX = -0.10 - this.squeezeAnim * 0.07;
      const yawY = -0.15 + (this.smoothedAim.x - holdX) * 0.85;
      this.props.sprayGroup.rotation.x += (pitchX - this.props.sprayGroup.rotation.x) * lerpRate;
      this.props.sprayGroup.rotation.y += (yawY - this.props.sprayGroup.rotation.y) * lerpRate;
      this.props.sprayGroup.rotation.z += (-0.06 - this.props.sprayGroup.rotation.z) * lerpRate;
      this.props.sprayShadow.material.opacity += (0.0 - this.props.sprayShadow.material.opacity) * lerpRate;
    } else {
      this.props.sprayGroup.position.lerp(this.props.sprayRestPos, lerpRate);
      this.props.sprayGroup.rotation.x += (this.props.sprayRestRot.x - this.props.sprayGroup.rotation.x) * lerpRate;
      this.props.sprayGroup.rotation.y += (this.props.sprayRestRot.y - this.props.sprayGroup.rotation.y) * lerpRate;
      this.props.sprayGroup.rotation.z += (sprayIdleWiggle - this.props.sprayGroup.rotation.z) * lerpRate;
      this.props.sprayShadow.material.opacity += (0.80 - this.props.sprayShadow.material.opacity) * lerpRate;
    }

    // --- 2. SQUEEGEE POSITIONING ---
    if (this.activeTool === 'squeegee') {
      const contactZ = this.isPressingGlass ? 0.096 : 0.165;
      const holdX = THREE.MathUtils.clamp(this.smoothedAim.x, -0.60, 0.60);
      const holdY = THREE.MathUtils.clamp(this.smoothedAim.y, this.room.SILL_Y + 0.08, 1.64);
      this.props.squeegeeGroup.position.lerp(new THREE.Vector3(holdX, holdY, contactZ), Math.min(1, dt * 18));
      const pitchX = this.isPressingGlass ? -0.52 : -0.34;
      this.props.squeegeeGroup.rotation.x += (pitchX - this.props.squeegeeGroup.rotation.x) * lerpRate;
      this.props.squeegeeGroup.rotation.y += (0.0 - this.props.squeegeeGroup.rotation.y) * lerpRate;
      this.props.squeegeeGroup.rotation.z += (this.bladeAngle - this.props.squeegeeGroup.rotation.z) * Math.min(1, dt * 16);
      this.props.squeegeeShadow.material.opacity += (0.0 - this.props.squeegeeShadow.material.opacity) * lerpRate;
    } else {
      this.props.squeegeeGroup.position.lerp(this.props.squeegeeRestPos, lerpRate);
      this.props.squeegeeGroup.rotation.x += (this.props.squeegeeRestRot.x - this.props.squeegeeGroup.rotation.x) * lerpRate;
      this.props.squeegeeGroup.rotation.y += (this.props.squeegeeRestRot.y - this.props.squeegeeGroup.rotation.y) * lerpRate;
      this.props.squeegeeGroup.rotation.z += (squeegeeIdleWiggle - this.props.squeegeeGroup.rotation.z) * lerpRate;
      this.props.squeegeeShadow.material.opacity += (0.74 - this.props.squeegeeShadow.material.opacity) * lerpRate;
    }

    const targetBeadOp = this.activeTool === 'squeegee' ? Math.min(0.92, this.plowFoamLoad * 1.1) : 0;
    this.props.plowFoamMat.opacity += (targetBeadOp - this.props.plowFoamMat.opacity) * Math.min(1, dt * 12);
    const beadScale = 0.65 + this.plowFoamLoad * 0.65;
    this.props.plowBead.scale.set(beadScale, 1, beadScale);

    // --- 3. FIRST-PERSON HAND ATTACHMENT (Forearm always anchors cleanly to viewer's right shoulder!) ---
    if (this.activeTool === 'spray') {
      this.hand.setVisible(true);
      this.hand.setPose('spray', this.squeezeAnim);
      this.hand.root.position.copy(this.props.sprayGroup.position).add(new THREE.Vector3(0.032, 0.215, 0.040));
      this.hand.root.rotation.set(
        -0.12 + this.props.sprayGroup.rotation.x * 0.5,
        -0.25 + this.props.sprayGroup.rotation.y * 0.5,
        -1.15
      );
      this.hand.alignForearmToShoulder();
    } else if (this.activeTool === 'squeegee') {
      this.hand.setVisible(true);
      this.hand.setPose('squeegee', 0);
      const handleLocal = new THREE.Vector3(0.008, 0.012, 0.095).applyEuler(this.props.squeegeeGroup.rotation);
      this.hand.root.position.copy(this.props.squeegeeGroup.position).add(handleLocal);
      this.hand.root.rotation.set(
        -0.24,
        -0.14,
        this.bladeAngle * 0.7 - 0.28
      );
      this.hand.alignForearmToShoulder();
    } else if (this.isPressingGlass) {
      this.hand.setVisible(true);
      this.hand.setPose('finger', 0);
      this.hand.root.position.lerp(
        new THREE.Vector3(this.smoothedAim.x + 0.025, this.smoothedAim.y - 0.015, 0.105),
        Math.min(1, dt * 22)
      );
      this.hand.root.rotation.set(0.18, -0.18, -0.32);
      this.hand.alignForearmToShoulder();
    } else {
      this.hand.setVisible(false);
    }
  }
}
