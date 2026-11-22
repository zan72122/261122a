import * as THREE from 'three';
import { buildLivingRoom } from './room.js';
import { buildVacuumSystem } from './vacuum.js';
import { DebrisSystem } from './debris.js';
import { VacuumAudio } from './audio.js';

const canvas = document.getElementById('viewport');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
let currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(currentPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 20);

function computeCameraConfig(width, height) {
  const aspect = width / Math.max(1, height);
  const isPortrait = aspect < 0.85;

  if (isPortrait) {
    // 390x844 iPhone Portrait: frames framed art, sofa, under-sofa, full open wicker basket, rug, hardwood, soft-roller head, 3/4 transparent dust cup, hand & knit sleeve
    return {
      isPortrait: true,
      fov: 52,
      basePos: new THREE.Vector3(0.06, 1.22, 1.62),
      baseLook: new THREE.Vector3(-0.04, 0.26, -0.58),
      handBaseOffset: new THREE.Vector3(0.165, -0.225, -0.64),
    };
  }
  // 1024x768 iPad Landscape: frames croissant coffee table, framed art, sofa, under-sofa, wicker basket, plant, floor head, 3/4 transparent dust cup & hand
  return {
    isPortrait: false,
    fov: 42,
    basePos: new THREE.Vector3(0.04, 1.12, 1.4),
    baseLook: new THREE.Vector3(-0.05, 0.26, -0.58),
    handBaseOffset: new THREE.Vector3(0.285, -0.16, -0.64),
  };
}

let camCfg = computeCameraConfig(window.innerWidth, window.innerHeight);

function applyCameraSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camCfg = computeCameraConfig(w, h);
  camera.fov = camCfg.fov;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentPixelRatio);
  renderer.setSize(w, h);
}

applyCameraSize();
window.addEventListener('resize', applyCameraSize);

/**
 * Subtle sunlit floating dust motes in the warm afternoon window light (adds living-room air & clean celebration glow)
 */
function createSunlitAirMotes(scene) {
  const count = 34;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = -0.7 + Math.random() * 1.9;
    pos[i * 3 + 1] = 0.22 + Math.random() * 1.15;
    pos[i * 3 + 2] = -1.2 + Math.random() * 1.8;
    phases[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  // Soft circular bokeh sprite texture (prevents square pixel motes!)
  const mc = document.createElement('canvas');
  mc.width = mc.height = 32;
  const mctx = mc.getContext('2d');
  const mg = mctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  mg.addColorStop(0, 'rgba(255, 248, 232, 1)');
  mg.addColorStop(0.45, 'rgba(255, 244, 220, 0.45)');
  mg.addColorStop(1, 'rgba(255, 240, 210, 0)');
  mctx.fillStyle = mg;
  mctx.fillRect(0, 0, 32, 32);
  const moteTex = new THREE.CanvasTexture(mc);

  const mat = new THREE.PointsMaterial({
    color: 0xfff5e0,
    map: moteTex,
    size: 0.018,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return { pts, pos, phases, mat };
}

async function init() {
  const [roomInfo, vacuumSys] = await Promise.all([
    buildLivingRoom(scene, renderer),
    buildVacuumSystem(scene, renderer),
  ]);

  const debris = new DebrisSystem(scene, roomInfo, vacuumSys);
  const audio = new VacuumAudio();
  const motes = createSunlitAirMotes(scene);

  // Start with a fresh empty transparent cup (ready for the child to fill up!)
  debris.populateInitialMess({ prefillCupSample: 0 });

  // Gameplay state
  const headPos = new THREE.Vector3(-0.08, debris.getFloorY(-0.08, 0.06), 0.06);
  const targetPos = headPos.clone();
  const headVel = new THREE.Vector3();
  let headYaw = 0.1;

  let activePointerId = null;
  let isDragging = false;
  let pointerDownPos = { x: 0, y: 0 };
  let lastInteractionTime = performance.now() * 0.001;
  let fullIdleTimer = 0;

  // Emptying choreography state machine
  let dumpState = 'none'; // 'none' | 'lifting' | 'pouring' | 'returning'
  let dumpTimer = 0;
  let dumpReleased = false;
  let tiltOverBin = 0;
  let cupOpen = 0;

  // Room completion celebration & tactile prop reaction state (non-blocking, warm sunlit transformation!)
  let hasCelebratedClean = false;
  let cleanGlow = 0;
  let croissantBounce = 0;
  let plantRustle = 0;
  let basketTapWobble = 0;
  let fullCupVib = 0;
  const croissantBaseY = roomInfo.croissantObj.position.y;
  const binBaseRotZ = roomInfo.binGroup.rotation.z;
  const plantBaseRotZ = roomInfo.plantObj.rotation.z;
  const tasselDummy = new THREE.Object3D();
  const nozzleWorldTmp = new THREE.Vector3();

  // Raycasting helpers for one-finger floor drag & tactile object taps
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  function setNDC(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  function startDumpIntoBin() {
    if (dumpState !== 'none') return;
    if (debris.cupItems.length === 0) return;
    dumpState = 'lifting';
    dumpTimer = 0;
    dumpReleased = false;
    isDragging = false;
    activePointerId = null;
    fullIdleTimer = 0;
  }

  /**
   * Constrains vacuum floor head naturally inside the living room, sliding smoothly around
   * coffee table, wicker basket, and sofa legs while allowing full entry UNDER THE SOFA!
   */
  function clampHeadTarget(x, z) {
    // Overall navigable room floor bounds
    x = THREE.MathUtils.clamp(x, -1.05, 0.92);
    z = THREE.MathUtils.clamp(z, -1.64, 0.56);

    // Slide around coffee table footprint on the left (leaving clear space right beside its front/right edge)
    const tb = roomInfo.tableBox;
    const txMin = tb.min.x - 0.14;
    const txMax = tb.max.x + 0.12;
    const tzMin = tb.min.z - 0.12;
    const tzMax = tb.max.z + 0.1;
    if (x > txMin && x < txMax && z > tzMin && z < tzMax) {
      const dxRight = Math.abs(x - txMax);
      const dzFront = Math.abs(z - tzMax);
      const dzBack = Math.abs(z - tzMin);
      if (dxRight <= dzFront && dxRight <= dzBack) x = txMax;
      else if (dzFront <= dzBack) z = tzMax;
      else z = tzMin;
    }

    // Slide smoothly around wicker basket base (unless triggering dump!)
    const bp = roomInfo.binPos;
    const bdx = x - bp.x;
    const bdz = z - bp.z;
    const bDist = Math.hypot(bdx, bdz);
    const minBinDist = 0.25;
    if (bDist < minBinDist && bDist > 0.001) {
      x = bp.x + (bdx / bDist) * minBinDist;
      z = bp.z + (bdz / bDist) * minBinDist;
    }

    // Under-sofa corridor: when pushing deeper than sofa front (z < -0.96), guide cleanly between sofa legs!
    const u = roomInfo.sofaUnderBounds;
    if (z < -0.95) {
      x = THREE.MathUtils.clamp(x, u.minX + 0.06, u.maxX - 0.06);
    }

    return { x, z };
  }

  function updateTargetFromPointer(clientX, clientY) {
    setNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
      // Check if child intentionally dragged right onto/near the wicker basket to empty the dust cup!
      const distToBin = Math.hypot(hitPoint.x - roomInfo.binPos.x, hitPoint.z - roomInfo.binPos.z);
      const rem = debris.getRemainingCounts();
      const readyToDump =
        debris.isCupFull() ||
        (rem.total === 0 && debris.cupItems.length > 0) ||
        debris.cupItems.length >= 8;
      if (readyToDump && distToBin < 0.39) {
        startDumpIntoBin();
        return;
      }

      const clamped = clampHeadTarget(hitPoint.x, hitPoint.z);
      targetPos.set(clamped.x, debris.getFloorY(clamped.x, clamped.z), clamped.z);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (activePointerId !== null) return; // Single-finger focus, multi-touch safe!
    audio.unlock();
    lastInteractionTime = performance.now() * 0.001;

    setNDC(e.clientX, e.clientY);
    raycaster.setFromCamera(pointerNDC, camera);

    // 1. Check playful tap on Croissant / Plate (spills fresh breadcrumbs onto floor for endless replay!)
    const croissantHits = raycaster.intersectObjects([roomInfo.croissantObj, roomInfo.plateObj], true);
    if (croissantHits.length > 0 && dumpState === 'none') {
      const added = debris.spawnFreshMessNearTable();
      if (added > 0) {
        croissantBounce = 1.0;
        hasCelebratedClean = false;
        audio.playCroissantCrunch();
      }
      return;
    }

    // 2. Check intuitive tap on Open Wicker Basket OR Transparent Dust Cup / Red Latch!
    if (dumpState === 'none') {
      const binHits = raycaster.intersectObject(roomInfo.binGroup, true);
      const cupHits = raycaster.intersectObject(vacuumSys.cupGroup, true);
      if (binHits.length > 0) {
        if (debris.cupItems.length >= 4) {
          startDumpIntoBin();
        } else {
          // Empty-cup tap: honest hollow rattan knock & tiny wobble (zero dead props!)
          basketTapWobble = 1.0;
          audio.playBasketKnock();
        }
        return;
      }
      if (cupHits.length > 0 && debris.cupItems.length >= 4) {
        startDumpIntoBin();
        return;
      }

      // 3. Playful tap on Potted Plant: gentle leaf rustle + tiny potting soil sprinkle!
      const plantHits = raycaster.intersectObject(roomInfo.plantObj, true);
      if (plantHits.length > 0) {
        plantRustle = 1.0;
        const added = debris.spawnPlantSoilMess();
        if (added > 0) hasCelebratedClean = false;
        audio.playPlantRustle();
        return;
      }

      // 4. Playful tap on Sofa Cushion: soft leather thump + gently nudges a couple hidden under-sofa crumbs into view!
      const sofaHits = raycaster.intersectObject(roomInfo.sofaObj, true);
      if (sofaHits.length > 0) {
        audio.playSofaThump();
        let nudged = 0;
        for (const it of debris.items) {
          if (it.state === 'floor' && it.zone === 'underSofa' && it.pos.z < -0.96 && nudged < 4) {
            it.pos.z += 0.14 + Math.random() * 0.08;
            nudged++;
          }
        }
        return;
      }
    }

    // 3. Otherwise: one-finger drag to vacuum!
    if (dumpState !== 'none') return;
    activePointerId = e.pointerId;
    isDragging = true;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    updateTargetFromPointer(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId || !isDragging) return;
    lastInteractionTime = performance.now() * 0.001;
    updateTargetFromPointer(e.clientX, e.clientY);
  });

  function endPointer(e) {
    if (e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // Camera & Hand smooth kinematic helpers
  const handWorld = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const camPosCurr = camCfg.basePos.clone();
  const camLookCurr = camCfg.baseLook.clone();
  const camPosGoal = new THREE.Vector3();
  const camLookGoal = new THREE.Vector3();
  const cupMouthPos = new THREE.Vector3();

  function computeHandAnchor(hPos, underAmt, motorActive, nowSec) {
    camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
    // Subtle realistic micro-vibration in the hand when the vacuum turbine is running (slightly stronger when cup is full!)
    const vibAmp = motorActive ? 0.0009 + fullCupVib * 0.0022 : 0;
    const vibX = vibAmp > 0 ? Math.sin(nowSec * 92) * vibAmp : 0;
    const vibY = vibAmp > 0 ? Math.cos(nowSec * 114) * vibAmp : 0;
    // When sliding under the sofa, drop the hand low toward the floor so the wand flattens cleanly UNDER the sofa apron!
    const crouchDrop = underAmt * 0.14;
    handWorld
      .copy(camera.position)
      .addScaledVector(camRight, camCfg.handBaseOffset.x + hPos.x * 0.14 + vibX)
      .addScaledVector(camUp, camCfg.handBaseOffset.y - crouchDrop + vibY)
      .addScaledVector(camFwd, camCfg.handBaseOffset.z);
    if (underAmt > 0.001) {
      // Smoothly guide hand height down to ~0.26m so wand slides cleanly under sofa arch while keeping battery pack well clear of rug!
      handWorld.y = THREE.MathUtils.lerp(handWorld.y, 0.26, underAmt * 0.85);
    }
    return handWorld;
  }

  // Initial pose ready immediately on frame 1
  camera.position.copy(camPosCurr);
  camera.lookAt(camLookCurr);
  camera.updateMatrixWorld(true);
  vacuumSys.updatePose(0.016, {
    headPos,
    handAnchor: computeHandAnchor(headPos, 0, false, 0),
    headYaw,
    sucking: false,
    cupOpen: 0,
  });

  canvas.classList.add('ready');

  let lastTime = performance.now();
  let frameCount = 0;
  let fpsAccum = 0;
  let lowFpsStreak = 0;
  let currentFps = 60;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const nowSec = now * 0.001;

    // Performance telemetry & dynamic pixel-ratio safeguard for mobile >= 30fps
    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 0.5) {
      currentFps = Math.round(frameCount / fpsAccum);
      frameCount = 0;
      fpsAccum = 0;
      if (currentFps < 28 && currentPixelRatio > 1.05) {
        lowFpsStreak++;
        if (lowFpsStreak >= 4) {
          currentPixelRatio = Math.max(1.0, currentPixelRatio - 0.15);
          renderer.setPixelRatio(currentPixelRatio);
          lowFpsStreak = 0;
        }
      } else {
        lowFpsStreak = 0;
      }
      const rem = debris.getRemainingCounts();
      const info = renderer.info;
      canvas.dataset.stats = JSON.stringify({
        fps: currentFps,
        triangles: info.render.triangles,
        calls: info.render.calls,
        pixelRatio: Number(renderer.getPixelRatio().toFixed(2)),
        viewport: [window.innerWidth, window.innerHeight],
        cupCount: rem.inCup,
        remainingRoom: rem.room,
        remainingUnderSofa: rem.underSofa,
        dumpState,
      });
    }

    // --- 1. DUMP CHOREOGRAPHY (Lifting cup over wicker basket -> Latch click -> Pour -> Snap shut!) ---
    if (dumpState === 'lifting') {
      dumpTimer += dt;
      const p = Math.min(1, dumpTimer / 0.48);
      tiltOverBin = p * p * (3 - 2 * p); // smoothstep
      if (p >= 1) {
        dumpState = 'pouring';
        dumpTimer = 0;
        audio.playLatchClick();
      }
    } else if (dumpState === 'pouring') {
      dumpTimer += dt;
      cupOpen = Math.min(1, dumpTimer / 0.16);
      if (!dumpReleased && dumpTimer >= 0.14) {
        dumpReleased = true;
        vacuumSys.getCupMouthWorldPos(cupMouthPos);
        const count = debris.releaseCupIntoBin(cupMouthPos, roomInfo.binPos);
        audio.playDumpCascade(count);
      }
      if (dumpTimer >= 0.92) {
        dumpState = 'returning';
        dumpTimer = 0;
        audio.playLidSnap();
      }
    } else if (dumpState === 'returning') {
      dumpTimer += dt;
      cupOpen = Math.max(0, 1 - dumpTimer / 0.14);
      const p = Math.min(1, dumpTimer / 0.45);
      tiltOverBin = 1 - p * p * (3 - 2 * p);
      if (p >= 1) {
        dumpState = 'none';
        tiltOverBin = 0;
        cupOpen = 0;
        // Pull target gently back onto open floor away from basket so it doesn't immediately re-trigger
        targetPos.set(
          Math.min(headPos.x, 0.25),
          debris.getFloorY(Math.min(headPos.x, 0.25), Math.max(headPos.z, -0.35)),
          Math.max(headPos.z, -0.35)
        );
      }
    }

    // --- 2. SMOOTH FLOOR HEAD KINEMATICS & UNDER-SOFA DETECTION ---
    const prevX = headPos.x;
    const prevZ = headPos.z;
    if (dumpState === 'none') {
      const followRate = isDragging ? 11.5 : 5.0;
      headPos.x += (targetPos.x - headPos.x) * Math.min(1, dt * followRate);
      headPos.z += (targetPos.z - headPos.z) * Math.min(1, dt * followRate);
      const floorY = debris.getFloorY(headPos.x, headPos.z);
      headPos.y += (floorY - headPos.y) * Math.min(1, dt * 16);

      headVel.set((headPos.x - prevX) / Math.max(0.001, dt), 0, (headPos.z - prevZ) / Math.max(0.001, dt));
      const speed = Math.hypot(headVel.x, headVel.z);

      // Gentle realistic head yaw aligning slightly with drag direction while staying ergonomic
      const desiredYaw =
        speed > 0.08
          ? THREE.MathUtils.clamp(Math.atan2(-headVel.x, -headVel.z) * 0.28, -0.42, 0.42)
          : THREE.MathUtils.clamp(-headPos.x * 0.2, -0.25, 0.25);
      headYaw += (desiredYaw - headYaw) * Math.min(1, dt * 6.5);
    } else {
      headVel.set(0, 0, 0);
    }

    const moveSpeed = Math.hypot(headVel.x, headVel.z);
    // Smoothly ramp underSofaAmount as floor head enters beneath the sofa apron (z < -0.94 -> -1.48)
    const underTarget =
      dumpState === 'none'
        ? THREE.MathUtils.clamp((-0.92 - headPos.z) / 0.45, 0, 1)
        : 0;
    vacuumSys.state.underSofaAmount +=
      (underTarget - vacuumSys.state.underSofaAmount) * Math.min(1, dt * 5.2);
    const underAmt = vacuumSys.state.underSofaAmount;

    // --- 3. CAMERA DYNAMIC FRAMING (Crouch to peek under sofa! Glance at basket during pour!) ---
    camPosGoal.copy(camCfg.basePos);
    camLookGoal.copy(camCfg.baseLook);

    // Subtle natural breathing
    camPosGoal.x += Math.sin(nowSec * 0.65) * 0.003;
    camPosGoal.y += Math.sin(nowSec * 1.05) * 0.002;

    if (underAmt > 0.001) {
      // Kneel low & lean forward so you peer straight UNDER the sofa apron with the headlight illuminating hidden crumbs & coins!
      camPosGoal.y = THREE.MathUtils.lerp(camPosGoal.y, 0.42, underAmt);
      camPosGoal.z = THREE.MathUtils.lerp(camPosGoal.z, 0.82, underAmt);
      camPosGoal.x += headPos.x * underAmt * 0.25;
      camLookGoal.y = THREE.MathUtils.lerp(camLookGoal.y, 0.09, underAmt);
      camLookGoal.z = THREE.MathUtils.lerp(camLookGoal.z, -1.25, underAmt);
      camLookGoal.x = THREE.MathUtils.lerp(camLookGoal.x, headPos.x * 0.55 - 0.1, underAmt);
    }

    if (tiltOverBin > 0.001) {
      // Gently turn gaze & step slightly toward the open wicker basket to savor the debris pouring right inside!
      camPosGoal.x = THREE.MathUtils.lerp(camPosGoal.x, roomInfo.binPos.x - 0.18, tiltOverBin * 0.38);
      camPosGoal.y = THREE.MathUtils.lerp(camPosGoal.y, 0.94, tiltOverBin * 0.42);
      camPosGoal.z = THREE.MathUtils.lerp(camPosGoal.z, 0.78, tiltOverBin * 0.45);
      camLookGoal.x = THREE.MathUtils.lerp(camLookGoal.x, roomInfo.binPos.x - 0.02, tiltOverBin * 0.78);
      camLookGoal.y = THREE.MathUtils.lerp(camLookGoal.y, roomInfo.binPos.y - 0.04, tiltOverBin * 0.72);
      camLookGoal.z = THREE.MathUtils.lerp(camLookGoal.z, roomInfo.binPos.z, tiltOverBin * 0.62);
    }

    camPosCurr.lerp(camPosGoal, Math.min(1, dt * 4.5));
    camLookCurr.lerp(camLookGoal, Math.min(1, dt * 5.0));
    camera.position.copy(camPosCurr);
    camera.lookAt(camLookCurr);
    camera.updateMatrixWorld(true);

    // --- 4. MOTOR, SUCTION & REAL-TIME FOLEY AUDIO ---
    const cupFull = debris.isCupFull();
    const motorActive = dumpState === 'none' && (isDragging || moveSpeed > 0.06);
    const onRug = debris.getFloorY(headPos.x, headPos.z) > 0.001;
    const fillRatio = debris.getCupFillRatio();

    audio.updateMotor(dt, {
      active: motorActive,
      onRug,
      fillRatio,
      speed: moveSpeed,
    });

    vacuumSys.updatePose(dt, {
      headPos,
      handAnchor: computeHandAnchor(headPos, underAmt, motorActive, nowSec),
      headYaw,
      sucking: motorActive,
      cupOpen,
      tiltOverBin,
      binWorldPos: roomInfo.binPos,
    });

    const { suckedTypes, fullBump } = debris.update(dt, {
      sucking: motorActive,
      headYaw,
    });
    for (const t of suckedTypes) {
      audio.playDebrisSuck(t);
    }
    fullCupVib += ((fullBump ? 1 : 0) - fullCupVib) * Math.min(1, dt * 8);

    // Interactive cotton rug fringe flutter when the active suction nozzle passes near the rug edge!
    vacuumSys.getNozzleWorldPos(nozzleWorldTmp);
    let anyTasselChanged = false;
    for (const td of roomInfo.tasselBaseData) {
      const dist = Math.hypot(td.x - nozzleWorldTmp.x, td.z - nozzleWorldTmp.z);
      const targetFlutter = motorActive && dist < 0.2 ? (1 - dist / 0.2) : 0;
      if (targetFlutter > 0.001 || td.flutter > 0.001) {
        td.flutter += (targetFlutter - td.flutter) * Math.min(1, dt * 14);
        const wave = Math.sin(nowSec * 38 + td.idx * 1.7) * td.flutter;
        tasselDummy.position.set(
          td.x + (nozzleWorldTmp.x - td.x) * td.flutter * 0.04,
          td.y + td.flutter * 0.006,
          td.z + (nozzleWorldTmp.z - td.z) * td.flutter * 0.04
        );
        tasselDummy.rotation.set(0, td.baseYaw + wave * 0.55, wave * 0.22 * td.side);
        tasselDummy.scale.set(td.lenScale, 1, 1);
        tasselDummy.updateMatrix();
        roomInfo.tassels.setMatrixAt(td.idx, tasselDummy.matrix);
        anyTasselChanged = true;
      }
    }
    if (anyTasselChanged) {
      roomInfo.tassels.instanceMatrix.needsUpdate = true;
    }

    // --- 5. SUBTLE WORDLESS AFFORDANCES & COMPLETION CELEBRATION ---
    const rem = debris.getRemainingCounts();

    // Gentle sympathetic wicker-basket wobble when dust cup is full (or everything is vacuumed) & on empty tap
    if (basketTapWobble > 0.001) {
      basketTapWobble = Math.max(0, basketTapWobble - dt * 3.8);
      roomInfo.binGroup.rotation.z = binBaseRotZ + Math.sin(basketTapWobble * Math.PI * 3) * 0.065 * basketTapWobble;
    } else if (dumpState === 'none' && (cupFull || (rem.total === 0 && rem.inCup > 0))) {
      fullIdleTimer += dt;
      const waitDelay = fullBump ? 0.1 : 1.5;
      if (fullIdleTimer > waitDelay) {
        const pulse = Math.sin((fullIdleTimer - waitDelay) * 3.8);
        roomInfo.binGroup.rotation.z = binBaseRotZ + (pulse > 0.45 ? (pulse - 0.45) * 0.065 : 0);
        vacuumSys.cupLatchGroup.position.z = pulse > 0.45 ? -(pulse - 0.45) * 0.009 : 0;
      }
    } else {
      fullIdleTimer = 0;
      roomInfo.binGroup.rotation.z += (binBaseRotZ - roomInfo.binGroup.rotation.z) * Math.min(1, dt * 8);
    }

    // Potted plant gentle springy leaf rustle when tapped
    if (plantRustle > 0.001) {
      plantRustle = Math.max(0, plantRustle - dt * 2.4);
      roomInfo.plantObj.rotation.z = plantBaseRotZ + Math.sin(plantRustle * Math.PI * 4) * 0.045 * plantRustle;
    } else {
      roomInfo.plantObj.rotation.z = plantBaseRotZ;
    }

    // Subtle LED pulse hint ONLY if floor is spotless, hidden crumbs remain under sofa, and idle > 4s
    const idleSec = nowSec - lastInteractionTime;
    if (dumpState === 'none' && rem.room === 0 && rem.underSofa > 0 && !cupFull && idleSec > 4.0) {
      const ledPulse = 0.5 + 0.5 * Math.sin((idleSec - 4.0) * 3.2);
      vacuumSys.headLedLight.intensity = 0.35 + ledPulse * 1.1;
    }

    // Croissant springy bounce when tapped to scatter fresh crumbs
    if (croissantBounce > 0.001) {
      croissantBounce = Math.max(0, croissantBounce - dt * 3.5);
      const lift = Math.sin(croissantBounce * Math.PI) * 0.028;
      roomInfo.croissantObj.position.y = croissantBaseY + lift;
      roomInfo.croissantObj.rotation.z = Math.sin(croissantBounce * Math.PI * 3) * 0.08;
    } else {
      roomInfo.croissantObj.position.y = croissantBaseY;
      roomInfo.croissantObj.rotation.z = 0;
    }

    // Spotless living room & emptied cup -> warm sunlit transformation!
    const allSpotless = rem.total === 0 && rem.inCup === 0 && dumpState === 'none';
    if (allSpotless && !hasCelebratedClean) {
      hasCelebratedClean = true;
      audio.playCleanChime();
    }
    cleanGlow += ((allSpotless ? 1 : 0) - cleanGlow) * Math.min(1, dt * 1.4);
    roomInfo.sunLight.intensity = 3.05 + cleanGlow * 0.45;
    motes.mat.opacity = 0.16 + cleanGlow * 0.34;

    // Drift warm sunlit air motes peacefully
    const pArr = motes.pos;
    for (let i = 0; i < motes.phases.length; i++) {
      const ph = motes.phases[i];
      pArr[i * 3 + 1] += Math.sin(nowSec * 0.45 + ph) * 0.00018;
      pArr[i * 3] += Math.cos(nowSec * 0.3 + ph * 1.3) * 0.00014;
    }
    motes.pts.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error('Initialization failed:', err);
});
