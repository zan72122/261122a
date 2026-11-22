import * as THREE from '../vendor/three.module.js';
import { SoundEngine } from './audio.js';
import { MaterialLibrary } from './materials.js';
import { buildPapercraftWorld } from './world.js';
import { CookieGame } from './game.js';

const canvas = document.getElementById('game-canvas');

// Renderer tuned for iPhone/iPad 30fps+ (pixel ratio strictly capped at 1.5!)
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
const effectivePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(effectivePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.2, 60);

const sound = new SoundEngine();
const mats = new MaterialLibrary();
const world = buildPapercraftWorld(scene, mats);
const game = new CookieGame(scene, camera, mats, world, sound);

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.98 ? 48 : 42;
  camera.updateProjectionMatrix();
  game.setAspect(w / h);
}
handleResize();
window.addEventListener('resize', handleResize);

// Single-finger locked pointer handling (multi-touch safe!)
let activePointerId = null;

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  if (canvas.setPointerCapture) {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  }
  game.onPointerDown(e.clientX, e.clientY, canvas);
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (e.pointerId !== activePointerId) return;
  game.onPointerMove(e.clientX, e.clientY, canvas);
});

function endPointer(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  game.onPointerUp();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Main animation loop with lightweight FPS meter
let lastTime = performance.now();
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  game.update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Invisible verification hook for automated visual & performance QA
window.__gameDebug = {
  getStats() {
    let maxTex = 0;
    const textures = new Set();
    scene.traverse((obj) => {
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of list) {
          for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap']) {
            if (m[key] && m[key].image) {
              textures.add(m[key]);
              maxTex = Math.max(maxTex, m[key].image.width || 0, m[key].image.height || 0);
            }
          }
        }
      }
    });
    return {
      stage: game.stage,
      packPhase: game.packPhase,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
      maxTexturePx: maxTex,
      textureCount: textures.size,
      fps: currentFps,
      cookiesCount: game.cookies.length,
    };
  },
  jumpStage(name) {
    game.debugJumpStage(name);
    game.update(0.016);
    renderer.render(scene, camera);
  },
  decorateDemo() {
    const c = game.cookies[game.activeCookieIdx];
    if (c) {
      game._addDemoDecorations(c);
      renderer.render(scene, camera);
    }
  },
};
