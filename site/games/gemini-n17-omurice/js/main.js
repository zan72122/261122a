import * as THREE from '../vendor/three/three.module.min.js';
import { KitchenDiorama, KITCHEN_CENTER, DINING_CENTER } from './kitchenScene.js';
import { StageRice } from './stageRice.js';
import { StageEggWrap } from './stageEggWrap.js';
import { StageDecorate } from './stageDecorate.js';
import { StageServe } from './stageServe.js';
import { audio } from './audio.js';

class OmuriceClayGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#ead7c0');
    this.scene.fog = new THREE.Fog('#ead7c0', 16, 30);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);

    // Warm miniature claymation studio 3-point lighting
    this._setupLights();

    // Shared cooking memory across stages
    this.recipeState = {
      ketchupAmount: 0,
      hasButter: false,
      bonusToppings: [],
      riceColorHex: '#e35d36',
      eggCount: 2,
      decorStrokes: 0,
    };

    // World & 4 tactile stages
    this.diorama = new KitchenDiorama(this.scene);

    this.stageRice = new StageRice(this.scene, this.diorama, this.recipeState, () => {
      this.setStage('eggWrap');
    });

    this.stageEggWrap = new StageEggWrap(this.scene, this.diorama, this.recipeState, () => {
      this.setStage('decorate');
    });

    this.stageDecorate = new StageDecorate(this.scene, this.recipeState, () => {
      this.setStage('serve');
    });

    this.stageServe = new StageServe(
      this.scene,
      this.diorama,
      this.stageDecorate,
      this.recipeState,
      () => {
        this._resetRecipe();
        this.setStage('rice');
      }
    );

    // Camera smooth rig
    this.camCurrentPos = new THREE.Vector3(0, 5.2, 5.0);
    this.camTargetPos = new THREE.Vector3(0, 5.2, 5.0);
    this.lookCurrent = new THREE.Vector3(0, 0.7, 0);
    this.lookTarget = new THREE.Vector3(0, 0.7, 0);
    this.lightTargetX = 0;

    // Single-finger pointer state
    this.activePointerId = null;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.panPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.90);
    this.tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);

    this.currentStage = 'rice';
    this._bindEvents();
    this.setStage('rice', true);
    this._applyOptionalQAQuery();

    // Expose read-only diagnostics & stage jump for automated visual inspection (no UI impact)
    window.__clayGame = {
      getStats: () => ({
        stage: this.currentStage,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pixelRatio: this.renderer.getPixelRatio(),
      }),
      goStage: (name) => this.setStage(name, true),
      demoAction: (action) => this._runDemoAction(action),
    };

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.statsSyncTimer = 0;
    this._animate();
  }

  _applyOptionalQAQuery() {
    const params = new URLSearchParams(window.location.search);
    const qa = params.get('qa');
    if (!qa) return;
    if (qa === 'rice_mixed') {
      this.setStage('rice', true);
      this._runDemoAction('squirtAndMix');
    } else if (qa === 'egg_init') {
      this.setStage('eggWrap', true);
    } else if (qa === 'egg_wrap') {
      this.setStage('eggWrap', true);
      this._runDemoAction('eggReadyWrap');
    } else if (qa === 'egg_folded') {
      this.setStage('eggWrap', true);
      this._runDemoAction('eggFolded');
    } else if (qa === 'decorate') {
      this.setStage('decorate', true);
      this._runDemoAction('drawSmile');
    } else if (qa === 'serve') {
      this.setStage('decorate', true);
      this._runDemoAction('drawSmile');
      this.setStage('serve', true);
    } else if (qa === 'serve_happy') {
      this.setStage('decorate', true);
      this._runDemoAction('drawSmile');
      this.setStage('serve', true);
      this._runDemoAction('feedOne');
    } else if (qa === 'serve_done') {
      this.setStage('decorate', true);
      this._runDemoAction('drawSmile');
      this.setStage('serve', true);
      this._runDemoAction('finishMeal');
    }
  }

  _setupLights() {
    // Cozy warm clay bounce hemisphere fill
    const hemi = new THREE.HemisphereLight('#f2f6ff', '#c99770', 0.95);
    this.scene.add(hemi);

    // Primary overhead-front warm miniature studio key light
    this.keyLight = new THREE.DirectionalLight('#fff2de', 2.05);
    this.keyLight.position.set(2.8, 8.6, 5.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 22.0;
    const d = 5.4;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // Warm golden rim light to catch hand-pressed fingerprint ridges along edges!
    this.rimLight = new THREE.DirectionalLight('#ffd49e', 0.78);
    this.rimLight.position.set(-4.5, 5.0, -4.2);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);
  }

  _resetRecipe() {
    this.recipeState.ketchupAmount = 0;
    this.recipeState.hasButter = false;
    this.recipeState.bonusToppings = [];
    this.recipeState.riceColorHex = '#e35d36';
    this.recipeState.eggCount = 2;
    this.recipeState.decorStrokes = 0;
  }

  _computeStageCamera(stageName) {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // Guarantee full interactive width (~6.6 world units) fits cleanly on BOTH iPhone portrait and iPad/desktop landscape!
    const vFov = aspect < 0.85 ? 46 : 42;
    if (this.camera.fov !== vFov) {
      this.camera.fov = vFov;
      this.camera.updateProjectionMatrix();
    }
    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(vFov * 0.5));
    const tanHalfH = tanHalfV * aspect;

    // Desired horizontal span per stage so side bottles/eggs/bell/family never clip on portrait or 4:3
    const neededHalfW = stageName === 'serve' ? 3.25 : 3.58;
    const minDistForWidth = neededHalfW / Math.max(0.14, tanHalfH);

    let look, baseOffset;
    if (stageName === 'rice') {
      look = new THREE.Vector3(0.02, 0.78, -0.05);
      baseOffset = new THREE.Vector3(0.0, 4.95, 4.75);
    } else if (stageName === 'eggWrap') {
      look = new THREE.Vector3(0.02, 0.78, -0.08);
      baseOffset = new THREE.Vector3(0.0, 5.05, 4.75);
    } else if (stageName === 'decorate') {
      look = new THREE.Vector3(DINING_CENTER.x, 0.56, DINING_CENTER.z - 0.32);
      baseOffset = new THREE.Vector3(0.0, 5.15, 4.25);
    } else {
      look = new THREE.Vector3(DINING_CENTER.x, 1.04, DINING_CENTER.z - 0.74);
      baseOffset = new THREE.Vector3(0.0, 3.25, 4.95);
    }

    const baseDist = baseOffset.length();
    const finalDist = Math.max(baseDist, minDistForWidth);
    const finalOffset = baseOffset.clone().multiplyScalar(finalDist / baseDist);
    const lightX = stageName === 'decorate' || stageName === 'serve' ? DINING_CENTER.x : 0;

    return { pos: look.clone().add(finalOffset), look, lightX };
  }

  setStage(name, instant = false) {
    this.currentStage = name;
    this.activePointerId = null;

    // Exit inactive stages cleanly
    if (name !== 'rice') this.stageRice.exit();
    if (name !== 'eggWrap') this.stageEggWrap.exit();
    if (name !== 'serve') this.stageServe.exit();

    if (name === 'rice') {
      this.stageDecorate.hideAll();
      this.stageRice.enter();
    } else if (name === 'eggWrap') {
      this.stageDecorate.hideAll();
      this.stageEggWrap.enter();
    } else if (name === 'decorate') {
      this.diorama.setFlameOn(false);
      this.stageDecorate.enter();
    } else if (name === 'serve') {
      this.diorama.setFlameOn(false);
      this.stageDecorate.hideToolsForServing();
      this.stageServe.enter();
    }

    const cam = this._computeStageCamera(name);
    this.camTargetPos.copy(cam.pos);
    this.lookTarget.copy(cam.look);
    this.lightTargetX = cam.lightX;

    if (instant) {
      this.camCurrentPos.copy(cam.pos);
      this.lookCurrent.copy(cam.look);
      this.camera.position.copy(this.camCurrentPos);
      this.camera.lookAt(this.lookCurrent);
      this._updateLightsPosition(cam.lightX);
    }
  }

  _updateLightsPosition(lx) {
    this.keyLight.position.set(lx + 2.8, 8.6, 5.2);
    this.keyLight.target.position.set(lx, 0.5, -0.2);
    this.keyLight.target.updateMatrixWorld();

    this.rimLight.position.set(lx - 4.5, 5.0, -4.2);
    this.rimLight.target.position.set(lx, 0.6, 0);
    this.rimLight.target.updateMatrixWorld();
  }

  _getRayInfo(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const targets = [];
    if (this.currentStage === 'rice') {
      targets.push(this.diorama.knobHitMesh, this.diorama.panHandleHitMesh, this.stageRice.group, this.diorama.panGroup);
    } else if (this.currentStage === 'eggWrap') {
      targets.push(this.diorama.knobHitMesh, this.diorama.panHandleHitMesh, this.stageEggWrap.group, this.diorama.panGroup);
    } else if (this.currentStage === 'decorate') {
      targets.push(this.stageDecorate.group);
    } else if (this.currentStage === 'serve') {
      targets.push(this.stageServe.group, this.stageDecorate.plateGroup);
    }

    const hits = this.raycaster.intersectObjects(targets, true);
    let interactiveHit = null;
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].object.userData && hits[i].object.userData.interact) {
        interactiveHit = hits[i];
        break;
      }
    }

    const worldOnPan = new THREE.Vector3();
    const hasPanPt = this.raycaster.ray.intersectPlane(this.panPlane, worldOnPan) !== null;

    const worldOnTable = new THREE.Vector3();
    const hasTablePt = this.raycaster.ray.intersectPlane(this.tablePlane, worldOnTable) !== null;

    return {
      hit: interactiveHit,
      worldOnPan: hasPanPt ? worldOnPan : null,
      worldOnTable: hasTablePt ? worldOnTable : null,
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
      this.camera.updateProjectionMatrix();
      const cam = this._computeStageCamera(this.currentStage);
      this.camTargetPos.copy(cam.pos);
      this.lookTarget.copy(cam.look);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      // Ignore secondary touches (strict one-finger safety!)
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      const info = this._getRayInfo(e.clientX, e.clientY);
      if (this.currentStage === 'rice') {
        this.stageRice.onPointerDown(info.hit, info.worldOnPan);
      } else if (this.currentStage === 'eggWrap') {
        this.stageEggWrap.onPointerDown(info.hit, info.worldOnPan);
      } else if (this.currentStage === 'decorate') {
        this.stageDecorate.onPointerDown(info.hit);
      } else if (this.currentStage === 'serve') {
        this.stageServe.onPointerDown(info.hit);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      const info = this._getRayInfo(e.clientX, e.clientY);
      if (this.currentStage === 'rice') {
        this.stageRice.onPointerMove(info.worldOnPan);
      } else if (this.currentStage === 'eggWrap') {
        this.stageEggWrap.onPointerMove(info.worldOnPan);
      } else if (this.currentStage === 'decorate') {
        this.stageDecorate.onPointerMove(info.hit);
      } else if (this.currentStage === 'serve') {
        this.stageServe.onPointerMove(info.worldOnTable);
      }
    });

    const endPointer = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      if (this.currentStage === 'rice') this.stageRice.onPointerUp();
      else if (this.currentStage === 'eggWrap') this.stageEggWrap.onPointerUp();
      else if (this.currentStage === 'decorate') this.stageDecorate.onPointerUp();
      else if (this.currentStage === 'serve') this.stageServe.onPointerUp();
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
  }

  _runDemoAction(action) {
    if (action === 'drawSmile') {
      // Draw a cute clay ketchup smile & heart on the omurice for visual verification!
      this.stageDecorate.activeTool = 'ketchup';
      // Cute ketchup smile, eyes, and carrot/cheese garnishes
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI;
        pts.push([Math.cos(a) * 0.52, 0.04 + Math.sin(a) * 0.25]);
      }
      pts.forEach((p, idx) => this.stageDecorate._placeDrawingPoint(p[0], p[1], idx === 0));
      this.stageDecorate._placeDrawingPoint(-0.28, -0.2, true);
      this.stageDecorate._placeDrawingPoint(0.28, -0.2, true);
      this.stageDecorate.activeTool = 'star';
      this.stageDecorate._placeDrawingPoint(-0.72, -0.08, true);
      this.stageDecorate.activeTool = 'heart';
      this.stageDecorate._placeDrawingPoint(0.72, -0.08, true);
      this.stageDecorate.activeTool = 'ketchup';
    } else if (action === 'squirtAndMix') {
      this.stageRice.squirtKetchup();
      this.stageRice.squirtKetchup();
      this.stageRice.addButter();
      this.stageRice.riceGrains.forEach((g) => (g.redness = 0.88));
    } else if (action === 'eggReadyWrap') {
      this.stageEggWrap.crackEgg(0);
      this.stageEggWrap.crackEgg(1);
      this.stageEggWrap.eggSpread = 1;
      this.stageEggWrap.eggCook = 1;
      this.stageEggWrap.rawYolks.forEach((y) => (y.visible = false));
      this.stageEggWrap.rawWhites.forEach((w) => (w.visible = false));
      this.stageEggWrap.chopsticks.visible = false;
      this.stageEggWrap.chopstickRest.visible = false;
      this.stageEggWrap.phase = 'placeRice';
      this.stageEggWrap.placeRiceInPan();
      this.stageEggWrap.riceDropT = 0.99;
    } else if (action === 'eggFolded') {
      this._runDemoAction('eggReadyWrap');
      this.stageEggWrap.update(0.05, 1, 1);
      this.stageEggWrap.frontFold = 1;
      this.stageEggWrap.backFold = 1;
      this.stageEggWrap.phase = 'readyFlip';
    } else if (action === 'feedOne') {
      this.stageServe.feedMember(2);
    } else if (action === 'finishMeal') {
      this.stageServe.bitesTaken = this.stageServe.maxBites;
      this.stageServe.finished = true;
      this.stageServe.replayReady = true;
      this.stageServe.replayPopT = 1;
      this.stageServe.replayPanGroup.visible = true;
      this.stageDecorate.omuriceMesh.visible = false;
      this.stageDecorate.omuriceInnerRice.visible = false;
      this.stageDecorate.decorLayer.visible = false;
      this.stageServe.members.forEach((fm) => {
        fm.state = 'happy';
        fm.stateTimer = 0;
        fm.openEyes.visible = false;
        fm.happyEyes.visible = true;
      });
      this.stageServe._spawnBurst(0, 2.0, -1.6, 8);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    // Authentic 12fps stop-motion clock for claymation props & character animations!
    const stopMotionStep = Math.floor(this.elapsed * 12);

    // Smooth camera & lighting glide between kitchen stove and dining table
    const lerpSpeed = Math.min(1, dt * 4.5);
    this.camCurrentPos.lerp(this.camTargetPos, lerpSpeed);
    this.lookCurrent.lerp(this.lookTarget, lerpSpeed);
    this.camera.position.copy(this.camCurrentPos);
    this.camera.lookAt(this.lookCurrent);

    const curLightX = THREE.MathUtils.lerp(this.keyLight.target.position.x, this.lightTargetX, lerpSpeed);
    this._updateLightsPosition(curLightX);

    // Update diorama & active stages
    this.diorama.update(dt, this.elapsed, stopMotionStep);
    this.stageRice.update(dt, this.elapsed, stopMotionStep);
    this.stageEggWrap.update(dt, this.elapsed, stopMotionStep);
    this.stageDecorate.update(dt, this.elapsed, stopMotionStep);
    this.stageServe.update(dt, this.elapsed, stopMotionStep);

    this.renderer.render(this.scene, this.camera);

    this.statsSyncTimer += dt;
    if (this.statsSyncTimer > 0.35) {
      this.statsSyncTimer = 0;
      this.canvas.dataset.stage = this.currentStage;
      this.canvas.dataset.triangles = String(this.renderer.info.render.triangles);
      this.canvas.dataset.calls = String(this.renderer.info.render.calls);
      this.canvas.dataset.dpr = String(this.renderer.getPixelRatio());
    }
  }
}

new OmuriceClayGame();
