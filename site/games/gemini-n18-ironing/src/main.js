import * as THREE from 'three';
import { loadAllAssets } from './assets.js';
import { buildRoomAndBoard, BOARD_Y } from './room.js';
import { buildSteamIron } from './iron.js';
import { createGarmentManager, GARMENT_CATALOG } from './garment.js';
import { createSteamSystem } from './steam.js';
import { createAudioEngine } from './audio.js';

async function init() {
  const container = document.getElementById('app');

  // =========================================================
  // 1. RENDERER & REALISTIC COLOR MANAGEMENT (AgX + sRGB)
  // =========================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  let currentDPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentDPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8e1d5');

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 18);

  // =========================================================
  // 2. LOAD BUNDLED CC0 POLY HAVEN & AMBIENTCG ASSETS
  // =========================================================
  const assets = await loadAllAssets(renderer);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(assets.hdriWarm);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.68;
  pmrem.dispose();

  // =========================================================
  // 3. LIGHTING: 1 WARM MORNING WINDOW KEY LIGHT + COOL SKY FILL
  // =========================================================
  // Raking morning sunlight pouring from left window across the ironing board creases!
  const sunLight = new THREE.DirectionalLight('#fff1da', 2.85);
  sunLight.position.set(-2.55, 1.85, 0.38);
  sunLight.target.position.set(0.0, BOARD_Y, -0.06);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.6;
  sunLight.shadow.camera.far = 6.2;
  sunLight.shadow.camera.left = -1.15;
  sunLight.shadow.camera.right = 1.15;
  sunLight.shadow.camera.top = 1.05;
  sunLight.shadow.camera.bottom = -0.95;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.010;
  sunLight.shadow.radius = 2.0;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Cool outdoor sky fill + warm hardwood floor bounce
  const hemiLight = new THREE.HemisphereLight('#d6e5f7', '#8b735a', 0.34);
  scene.add(hemiLight);

  // =========================================================
  // 4. BUILD WORLD, IRONING BOARD, STEAM IRON, GARMENTS & STEAM
  // =========================================================
  const room = buildRoomAndBoard(scene, assets);
  const iron = buildSteamIron(scene, assets, room.restCenter);
  const garments = createGarmentManager(scene, assets, room);
  const steam = createSteamSystem(scene);
  const audio = createAudioEngine();

  // =========================================================
  // 5. DUAL RESPONSIVE FIRST-PERSON CAMERA (iPhone Portrait & iPad Landscape)
  // =========================================================
  const camTarget = new THREE.Vector3();
  function updateCameraFraming() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;

    if (aspect < 0.78) {
      // iPhone Portrait (390x844): Generous balanced POV showing FULL ironing board, crumpled garment,
      // ENTIRE steam iron (including rear heel & cord!), amber spray bottle, oak side table & wicker basket!
      camera.fov = 53;
      camera.position.set(0.05, 2.16, 1.68);
      camTarget.set(0.04, BOARD_Y - 0.04, -0.14);
    } else if (aspect < 1.15) {
      camera.fov = 42;
      camera.position.set(0.03, 1.62, 1.06);
      camTarget.set(0.01, BOARD_Y - 0.02, -0.15);
    } else {
      // iPad Landscape / Desktop (1024x768): Real 40mm camera POV showing ironing board foreground,
      // side table folded stack & wicker basket mid-ground, and sunlit window + plant + sofa background!
      camera.fov = 39;
      camera.position.set(0.02, 1.50, 0.98);
      camTarget.set(0.0, BOARD_Y - 0.01, -0.16);
    }
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  updateCameraFraming();
  window.addEventListener('resize', updateCameraFraming);

  // =========================================================
  // 6. ONE-FINGER INTUITIVE INTERACTION STATE MACHINE (ZERO TEXT!)
  // =========================================================
  let phase = 'ironing';
  let activePointerId = null;
  let draggingIron = false;
  let swipeStart = null;
  const ironPos = iron.restPos.clone();
  const ironTarget = iron.restPos.clone();
  let ironRotY = iron.restRotY;
  let ironTargetRotY = iron.restRotY;
  const ironVel = new THREE.Vector3();
  let lastInteractionTime = performance.now() * 0.001;
  let idleHintCooldown = 0;

  let sprayAnim = 0;
  const bottleRestPos = room.sprayBottle.position.clone();
  const bottleRestRot = room.sprayBottle.rotation.clone();
  let plantRustle = 0;

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BOARD_Y + 0.004));
  const hitPt = new THREE.Vector3();

  function setPointerNDC(clientX, clientY) {
    pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  function raycastBoard(clientX, clientY, outVec) {
    setPointerNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);
    return raycaster.ray.intersectPlane(boardPlane, outVec);
  }

  function clampToBoard(v) {
    v.x = THREE.MathUtils.clamp(v.x, -0.36, 0.34);
    v.z = THREE.MathUtils.clamp(v.z, -0.145, 0.145);
    return v;
  }

  function triggerWaterSpray() {
    if (sprayAnim > 0.05) return;
    sprayAnim = 1.0;
    audio.playSprayMist();

    const tx = garments.workCenter.x + (Math.random() - 0.5) * 0.14;
    const tz = garments.workCenter.z + (Math.random() - 0.5) * 0.11;
    const target = new THREE.Vector3(tx, BOARD_Y + 0.015, tz);

    setTimeout(() => {
      const nozzleWorld = room.sprayBottle.userData.nozzleLocal
        .clone()
        .applyMatrix4(room.sprayBottle.matrixWorld);
      steam.emitWaterMist(nozzleWorld, target, 28);
      garments.applyWaterMist(tx, tz, 0.125);
    }, 110);
  }

  function onPointerDown(e) {
    if (activePointerId !== null) return;
    audio.unlock();
    activePointerId = e.pointerId;
    lastInteractionTime = performance.now() * 0.001;

    setPointerNDC(e.clientX, e.clientY);
    raycaster.setFromCamera(pointerNDC, camera);

    if (phase === 'ironing' && raycaster.intersectObject(room.sprayBottle, true).length > 0) {
      triggerWaterSpray();
      return;
    }

    if (garments.getStackCount() > 0 && raycaster.intersectObject(garments.stackGroup, true).length > 0) {
      garments.pokeStack();
      audio.playClothFold(0.85);
      return;
    }

    if (raycaster.intersectObject(room.plant, true).length > 0) {
      plantRustle = 1.0;
      audio.playClothFold(1.4);
      return;
    }

    const hitBasket =
      raycaster.intersectObject(room.basketGroup, true).length > 0 ||
      raycaster.intersectObject(garments.basketLaundryGroup, true).length > 0;
    if (hitBasket) {
      audio.playClothFold(0.95);
      if (phase === 'pickNext' && !garments.isAnimating()) {
        garments.setBasketInvite(false);
        garments.spawnNextFromBasket();
        phase = 'ironing';
      }
      return;
    }

    if (phase === 'ironing') {
      const hitIron = raycaster.intersectObject(iron.group, true).length > 0;
      const onBoard = raycastBoard(e.clientX, e.clientY, hitPt);
      if (hitIron || (onBoard && hitPt.distanceTo(ironPos) < 0.22)) {
        draggingIron = true;
        iron.setHeld(true);
        audio.playSteamPuff(0.55);
        steam.emitIronBurst(ironPos, 0.75, 7);
        if (onBoard) {
          clampToBoard(hitPt);
          ironTarget.set(hitPt.x, BOARD_Y + 0.004, hitPt.z);
        }
      } else if (onBoard && raycaster.intersectObject(garments.getActiveMesh(), false).length > 0) {
        audio.playClothFold(1.1);
        audio.playSteamPuff(0.45);
        steam.emitIronBurst(ironPos, 0.65, 6);
        ironTarget.set(iron.restPos.x - 0.018, iron.restPos.y + 0.008, iron.restPos.z);
        setTimeout(() => {
          if (!draggingIron) ironTarget.copy(iron.restPos);
        }, 220);
      }
    } else if (phase === 'folding') {
      if (!garments.isAnimating()) {
        swipeStart = { x: e.clientX, y: e.clientY, folded: false };
      }
    } else if (phase === 'pickNext') {
      audio.playSoftThud(false);
    }
  }

  function onPointerMove(e) {
    if (e.pointerId !== activePointerId) return;
    lastInteractionTime = performance.now() * 0.001;

    if (draggingIron && phase === 'ironing') {
      if (raycastBoard(e.clientX, e.clientY, hitPt)) {
        clampToBoard(hitPt);
        ironTarget.set(hitPt.x, BOARD_Y + 0.003, hitPt.z);
      }
    } else if (phase === 'folding' && swipeStart && !swipeStart.folded) {
      const dist = Math.hypot(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
      if (dist > 26) {
        swipeStart.folded = true;
        if (garments.triggerNextFold()) {
          audio.playClothFold(1.0 + garments.getFoldStage() * 0.08);
        }
      }
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;

    if (phase === 'folding' && swipeStart && !swipeStart.folded) {
      setPointerNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      if (raycaster.intersectObject(garments.getActiveMesh(), false).length > 0) {
        if (garments.triggerNextFold()) {
          audio.playClothFold(1.0 + garments.getFoldStage() * 0.08);
        }
      }
    }
    swipeStart = null;

    if (draggingIron) {
      draggingIron = false;
      iron.setHeld(false);
      ironTarget.copy(iron.restPos);
      ironTargetRotY = iron.restRotY;
      audio.playSoftThud(true);
      audio.updateIronLoop(0, false, 0);
    }
  }

  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // =========================================================
  // 7. MAIN SIMULATION & RENDER LOOP (ADAPTIVE DPR 1.0–1.5)
  // =========================================================
  let lastTime = performance.now() * 0.001;
  let steamAccum = 0;
  let idleSteamTimer = 0;
  let fpsFrames = 0;
  let fpsStart = performance.now();
  let measuredFPS = 60;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, now - lastTime));
    lastTime = now;

    fpsFrames++;
    const elapsedMs = performance.now() - fpsStart;
    if (elapsedMs >= 1200) {
      measuredFPS = Math.round((fpsFrames * 1000) / elapsedMs);
      fpsFrames = 0;
      fpsStart = performance.now();
      if (measuredFPS < 28 && currentDPR > 1.0) {
        currentDPR = Math.max(1.0, currentDPR - 0.25);
        renderer.setPixelRatio(currentDPR);
      }
    }

    const prevX = ironPos.x;
    const prevZ = ironPos.z;
    const followSpeed = draggingIron ? 15 : 8;
    ironPos.lerp(ironTarget, Math.min(1, dt * followSpeed));
    ironVel.set((ironPos.x - prevX) / dt, 0, (ironPos.z - prevZ) / dt);
    const speed = Math.hypot(ironVel.x, ironVel.z);

    if (draggingIron && speed > 0.05) {
      const moveAngle = Math.atan2(-ironVel.x, -ironVel.z);
      const clampedAngle = THREE.MathUtils.clamp(moveAngle, -0.35, Math.PI * 0.82);
      ironTargetRotY = THREE.MathUtils.lerp(ironTargetRotY, clampedAngle, Math.min(1, dt * 4.5));
    }
    ironRotY += (ironTargetRotY - ironRotY) * Math.min(1, dt * 8);

    const distFromRest = Math.hypot(ironPos.x - iron.restPos.x, ironPos.z - iron.restPos.z);
    const liftY = !draggingIron && distFromRest > 0.04 ? Math.min(0.045, distFromRest * 0.14) : 0;
    iron.group.position.set(ironPos.x, ironPos.y + liftY, ironPos.z);
    iron.group.rotation.y = ironRotY;
    iron.group.rotation.x = draggingIron ? THREE.MathUtils.clamp(-ironVel.z * 0.08, -0.05, 0.05) : 0;
    iron.group.rotation.z = draggingIron ? THREE.MathUtils.clamp(ironVel.x * 0.08, -0.05, 0.05) : 0;

    let steamingNow = false;
    if (draggingIron && phase === 'ironing') {
      const res = garments.applyIronPress(ironPos.x, ironPos.z, ironRotY, speed, dt, now);
      if (res.hitButton) audio.playButtonClick();

      const moistureFactor = Math.min(1, res.steamFromMoisture * 22);
      audio.updateIronLoop(speed, res.onCloth, moistureFactor);

      if (res.onCloth) {
        steamingNow = true;
        steamAccum += dt * (11 + speed * 26 + moistureFactor * 36);
        while (steamAccum >= 1) {
          steamAccum -= 1;
          const ang = Math.random() * Math.PI * 2;
          const rad = 0.042 + Math.random() * 0.03;
          steam.emitSteam(
            ironPos.x + Math.cos(ang) * rad,
            ironPos.y + 0.012,
            ironPos.z + Math.sin(ang) * rad,
            {
              vx: Math.cos(ang) * (0.06 + moistureFactor * 0.09) - ironVel.x * 0.15,
              vy: 0.13 + moistureFactor * 0.14,
              vz: Math.sin(ang) * (0.06 + moistureFactor * 0.09) - ironVel.z * 0.15,
              life: 0.8 + moistureFactor * 0.55,
              startScale: 0.04,
              endScale: 0.18 + moistureFactor * 0.14,
              opacity: 0.22 + moistureFactor * 0.22,
            }
          );
        }
        if (moistureFactor > 0.35 && Math.random() < dt * 4.5) {
          audio.playSteamPuff(1.0);
        }
      }

      if (garments.getSmoothness() >= 0.85 && !garments.isAnimating()) {
        phase = 'folding';
        draggingIron = false;
        iron.setHeld(false);
        ironTarget.copy(iron.restPos);
        ironTargetRotY = iron.restRotY;
        audio.updateIronLoop(0, false, 0);
        audio.playSteamPuff(0.75);
        steam.emitIronBurst(ironPos, 0.9, 9);
      }
    } else {
      idleSteamTimer += dt;
      if (idleSteamTimer > 1.1) {
        idleSteamTimer = 0;
        steam.emitSteam(ironPos.x - 0.03, ironPos.y + 0.02, ironPos.z, {
          vy: 0.11,
          life: 1.05,
          startScale: 0.032,
          endScale: 0.12,
          opacity: 0.14,
          spread: 0.025,
        });
      }
    }

    const idleSec = now - lastInteractionTime;
    if (idleSec > 10 && idleHintCooldown <= 0) {
      idleHintCooldown = 7.5;
      if (phase === 'ironing') {
        steam.emitIronBurst(ironPos, 0.65, 5);
        audio.playSteamPuff(0.4);
      } else if (phase === 'pickNext') {
        garments.setBasketInvite(true);
      }
    }
    if (idleHintCooldown > 0) idleHintCooldown -= dt;

    if (sprayAnim > 0) {
      sprayAnim = Math.max(0, sprayAnim - dt * 2.1);
      const lift = Math.sin(sprayAnim * Math.PI);
      room.sprayBottle.position.set(
        bottleRestPos.x - lift * 0.075,
        bottleRestPos.y + lift * 0.072,
        bottleRestPos.z + lift * 0.04
      );
      room.sprayBottle.rotation.z = lift * 0.24;
      room.sprayBottle.userData.triggerPivot.rotation.x = lift * 0.45;
      room.bottleShadow.material.opacity = 0.42 * (1 - lift * 0.65);
    } else {
      room.sprayBottle.position.copy(bottleRestPos);
      room.sprayBottle.rotation.copy(bottleRestRot);
      room.sprayBottle.userData.triggerPivot.rotation.x = 0;
      room.bottleShadow.material.opacity = 0.42;
    }

    if (plantRustle > 0) {
      plantRustle = Math.max(0, plantRustle - dt * 1.8);
      room.plant.rotation.z = Math.sin(now * 16) * plantRustle * 0.03;
    }

    iron.updateVisuals(dt, ironVel.x, ironVel.z, steamingNow, now);
    garments.update(dt, now, phase === 'folding', () => {
      audio.playSoftThud(false);
      phase = 'pickNext';
      garments.setBasketInvite(true);
    });
    steam.update(dt, now);
    room.updateRoom(now, dt);

    renderer.render(scene, camera);
  }

  // Quiet inspection hook for visual QA (zero on-screen UI!)
  function runDemoIroning() {
    garments.addFoldedItemToStack(GARMENT_CATALOG[1]);
    garments.addFoldedItemToStack(GARMENT_CATALOG[3]);
    garments.addFoldedItemToStack(GARMENT_CATALOG[4]);
    garments.applyWaterMist(-0.04, 0.02, 0.11);
    iron.setHeld(true, true);
    draggingIron = true;
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      const x = -0.22 + k * 0.21;
      const z = -0.05 + Math.sin(k * Math.PI * 2.2) * 0.06;
      ironPos.set(x, BOARD_Y + 0.004, z);
      ironTarget.copy(ironPos);
      ironRotY = Math.PI * 0.44;
      ironTargetRotY = ironRotY;
      garments.applyIronPress(x, z, ironRotY, 0.5, 0.14, 1.0);
    }
    iron.group.position.copy(ironPos);
    iron.group.rotation.set(0, ironRotY, 0);
    iron.updateVisuals(0.016, 0.2, 0.02, true, 1.0);
    steam.emitIronBurst(ironPos, 1.35, 22);
    for (let i = 0; i < 6; i++) steam.update(0.035, 1.0 + i * 0.035);
  }

  window.__ironingDebug = {
    getStats: () => ({
      phase,
      smoothness: Number(garments.getSmoothness().toFixed(3)),
      foldStage: garments.getFoldStage(),
      stackCount: garments.getStackCount(),
      garmentId: garments.getActiveSpec()?.id,
      fps: measuredFPS,
      dpr: currentDPR,
      triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    }),
    runDemoIroning,
    spawnShirt: () => {
      garments.spawnNextFromBasket();
      renderer.render(scene, camera);
    },
  };

  // Optional query param for visual verification captures only
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === 'iron') {
    runDemoIroning();
  } else if (params.get('demo') === 'shirt') {
    garments.addFoldedItemToStack(GARMENT_CATALOG[0]);
    garments.spawnNextFromBasket();
    // Skip fly animation to inspect crisp shirt layout immediately
    for (let i = 0; i < 30; i++) garments.update(0.03, i * 0.03, false);
  }

  renderer.render(scene, camera);
  document.getElementById('curtain')?.remove();
  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error('Initialization failed:', err);
});
