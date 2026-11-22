import * as THREE from 'three';
import {
  createDoughTextures,
  createPepperoniTexture,
  createMushroomTexture,
  createBasilTexture,
  createCherryTomatoTexture
} from './textures.js';

export const PIZZA_FULL_RADIUS = 1.15;
export const SLICE_COUNT = 6;

export class MiniPizza {
  constructor() {
    this.group = new THREE.Group();
    this.wholeGroup = new THREE.Group();
    this.slicesGroup = new THREE.Group();
    this.slicesGroup.visible = false;
    this.group.add(this.wholeGroup);
    this.group.add(this.slicesGroup);

    // State
    this.stretchProgress = 0; // 0 = plump dough ball, 1 = full stretched round
    this.squashImpulse = 0;
    this.aspectBiasX = 1;
    this.aspectBiasZ = 1;
    this.bakeProgress = 0;    // 0 = raw, 1 = golden bubbly Neapolitan perfection

    // Shared textures & canvases
    this.doughTexData = createDoughTextures(512);
    this.doughCanvas = document.createElement('canvas');
    this.doughCanvas.width = 512;
    this.doughCanvas.height = 512;
    this.doughCtx = this.doughCanvas.getContext('2d');
    this.doughTex = new THREE.CanvasTexture(this.doughCanvas);
    this.doughTex.colorSpace = THREE.SRGBColorSpace;
    this.lastBakedTexVal = -1;

    // Paintable glossy tomato sauce canvas (512x512)
    this.sauceCanvas = document.createElement('canvas');
    this.sauceCanvas.width = 512;
    this.sauceCanvas.height = 512;
    this.sauceCtx = this.sauceCanvas.getContext('2d');
    this.sauceTex = new THREE.CanvasTexture(this.sauceCanvas);
    this.sauceTex.colorSpace = THREE.SRGBColorSpace;

    // Sauce coverage grid (20x20 within inner circle)
    this.sauceGridSize = 20;
    this.sauceGrid = new Uint8Array(this.sauceGridSize * this.sauceGridSize);
    this.sauceCoverage = 0;

    // Melted cheese blanket canvas (appears smoothly during baking where cheese was placed!)
    this.cheeseCanvas = document.createElement('canvas');
    this.cheeseCanvas.width = 512;
    this.cheeseCanvas.height = 512;
    this.cheeseCtx = this.cheeseCanvas.getContext('2d');
    this.cheeseTex = new THREE.CanvasTexture(this.cheeseCanvas);
    this.cheeseTex.colorSpace = THREE.SRGBColorSpace;

    // Topping shared assets
    this._initToppingAssets();

    // Build deformable whole dough + sauce + melted cheese overlay
    this._buildWholePizza();

    // Toppings list & bubbles
    this.toppingsGroup = new THREE.Group();
    this.wholeGroup.add(this.toppingsGroup);
    this.toppings = [];
    this.cheeseBubbles = [];
    this.bubblesGroup = new THREE.Group();
    this.wholeGroup.add(this.bubblesGroup);

    // Sliced wedges state
    this.slices = [];
    this.cutStates = [false, false, false]; // 3 diameter cuts -> 6 wedges

    // Stretchy cheese strands when lifting a slice
    this.strandsGroup = new THREE.Group();
    this.group.add(this.strandsGroup);
    this.strands = [];
    this._initCheeseStrands();

    this.reset();
  }

  _initToppingAssets() {
    this.pepTex = createPepperoniTexture();
    this.mushTex = createMushroomTexture();
    this.basilTex = createBasilTexture();
    this.tomatoTex = createCherryTomatoTexture();

    // Reusable geometries
    this.cheeseShredGeo = new THREE.CapsuleGeometry(0.013, 0.082, 4, 6);
    this.cheeseShredGeo.rotateZ(Math.PI / 2);

    this.pepGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.022, 18);
    this.tomatoBodyGeo = new THREE.CylinderGeometry(0.118, 0.088, 0.052, 16);
    this.tomatoCutGeo = new THREE.CircleGeometry(0.114, 16);
    this.tomatoCutGeo.rotateX(-Math.PI / 2);

    this.cornGeo = new THREE.SphereGeometry(0.044, 8, 7);
    this.cornGeo.scale(1.15, 0.72, 0.92);

    // Sculpted mushroom slice shape with normalized [0..1] UVs so cap & gills render crisply!
    const mShape = new THREE.Shape();
    mShape.moveTo(-0.045, -0.11);
    mShape.lineTo(0.045, -0.11);
    mShape.quadraticCurveTo(0.055, -0.02, 0.125, -0.01);
    mShape.absarc(0, 0.02, 0.125, -0.22, Math.PI + 0.22, false);
    mShape.quadraticCurveTo(-0.055, -0.02, -0.045, -0.11);
    this.mushGeo = new THREE.ExtrudeGeometry(mShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2
    });
    this.mushGeo.rotateX(-Math.PI / 2);
    const mPos = this.mushGeo.attributes.position;
    const mUv = this.mushGeo.attributes.uv;
    for (let i = 0; i < mPos.count; i++) {
      const mx = mPos.getX(i);
      const mz = mPos.getZ(i);
      mUv.setXY(i, (mx + 0.135) / 0.27, 1 - (mz + 0.15) / 0.27);
    }

    // Basil teardrop leaf shape with normalized [0..1] UVs so leaf veins render crisply!
    const bShape = new THREE.Shape();
    bShape.moveTo(0, -0.11);
    bShape.bezierCurveTo(0.11, -0.05, 0.1, 0.07, 0, 0.14);
    bShape.bezierCurveTo(-0.1, 0.07, -0.11, -0.05, 0, -0.11);
    this.basilGeo = new THREE.ShapeGeometry(bShape, 8);
    this.basilGeo.rotateX(-Math.PI / 2);
    const bPos = this.basilGeo.attributes.position;
    const bUv = this.basilGeo.attributes.uv;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const z = bPos.getZ(i);
      bPos.setY(i, Math.abs(x) * 0.22 - z * z * 0.6 + 0.014);
      bUv.setXY(i, (x + 0.11) / 0.22, (z + 0.14) / 0.26);
    }
    this.basilGeo.computeVertexNormals();

    this.bubbleGeo = new THREE.SphereGeometry(0.055, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65);

    // Materials (cloned per bake state or smoothly updated together)
    this.mats = {
      cheese: new THREE.MeshStandardMaterial({
        color: 0xfdf4d8,
        roughness: 0.78,
        metalness: 0.02
      }),
      pepperoni: new THREE.MeshStandardMaterial({
        map: this.pepTex,
        roughness: 0.48,
        metalness: 0.03
      }),
      tomatoSkin: new THREE.MeshStandardMaterial({
        color: 0xc21f16,
        roughness: 0.2,
        metalness: 0.04
      }),
      tomatoInside: new THREE.MeshPhysicalMaterial({
        map: this.tomatoTex,
        roughness: 0.2,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14
      }),
      corn: new THREE.MeshStandardMaterial({
        color: 0xf5c838,
        roughness: 0.28,
        metalness: 0.02
      }),
      mushroom: new THREE.MeshStandardMaterial({
        map: this.mushTex,
        roughness: 0.78,
        metalness: 0.01
      }),
      basil: new THREE.MeshStandardMaterial({
        map: this.basilTex,
        roughness: 0.56,
        side: THREE.DoubleSide
      }),
      bubble: new THREE.MeshStandardMaterial({
        color: 0xffe49c,
        roughness: 0.2,
        metalness: 0.04
      })
    };
  }

  _buildWholePizza() {
    // Radial mesh: rings=14, segs=56 for silky macro close-up curves in the brick oven!
    this.rings = 14;
    this.segs = 56;
    const vertCount = (this.rings + 1) * (this.segs + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    // Store subtle organic bump seed per radial angle for natural artisan round handmade crust!
    this.rimNoise = new Float32Array(this.segs + 1);
    for (let s = 0; s <= this.segs; s++) {
      const a = (s / this.segs) * Math.PI * 2;
      this.rimNoise[s] =
        Math.sin(a * 5 + 0.4) * 0.015 +
        Math.cos(a * 9 - 0.8) * 0.009 +
        Math.sin(a * 13 + 1.5) * 0.006;
    }

    let idx = 0;
    for (let r = 0; r <= this.rings; r++) {
      const rn = r / this.rings; // 0 center .. 0.92 outer rim .. 1.0 bottom tuck
      for (let s = 0; s <= this.segs; s++) {
        const a = (s / this.segs) * Math.PI * 2;
        const u = 0.5 + Math.cos(a) * Math.min(rn / 0.92, 1) * 0.495;
        const v = 0.5 + Math.sin(a) * Math.min(rn / 0.92, 1) * 0.495;
        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = 1 - v;
        idx++;
      }
    }

    for (let r = 0; r < this.rings; r++) {
      for (let s = 0; s < this.segs; s++) {
        const a = r * (this.segs + 1) + s;
        const b = a + 1;
        const c = (r + 1) * (this.segs + 1) + s;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    this.doughGeo = new THREE.BufferGeometry();
    this.doughGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.doughGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.doughGeo.setIndex(indices);

    this.doughMat = new THREE.MeshStandardMaterial({
      map: this.doughTex,
      bumpMap: this.doughTexData.bumpMap,
      bumpScale: 0.024,
      roughness: 0.88,
      metalness: 0.01
    });

    this.doughMesh = new THREE.Mesh(this.doughGeo, this.doughMat);
    this.doughMesh.castShadow = true;
    this.doughMesh.receiveShadow = true;
    this.wholeGroup.add(this.doughMesh);

    // Glossy dynamic tomato sauce layer conforming to the inner dough surface
    this.sauceGeo = new THREE.CircleGeometry(PIZZA_FULL_RADIUS * 0.86, 40);
    this.sauceGeo.rotateX(-Math.PI / 2);
    this.sauceMat = new THREE.MeshPhysicalMaterial({
      map: this.sauceTex,
      transparent: true,
      opacity: 0.98,
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
    this.sauceMesh = new THREE.Mesh(this.sauceGeo, this.sauceMat);
    this.sauceMesh.position.y = 0.062;
    this.sauceMesh.receiveShadow = true;
    this.wholeGroup.add(this.sauceMesh);

    // Melted bubbling cheese blanket layer (fades in smoothly during baking!)
    this.cheeseOverlayGeo = new THREE.CircleGeometry(PIZZA_FULL_RADIUS * 0.85, 36);
    this.cheeseOverlayGeo.rotateX(-Math.PI / 2);
    this.cheeseOverlayMat = new THREE.MeshPhysicalMaterial({
      map: this.cheeseTex,
      transparent: true,
      opacity: 0,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.82,
      clearcoatRoughness: 0.16,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    this.cheeseOverlayMesh = new THREE.Mesh(this.cheeseOverlayGeo, this.cheeseOverlayMat);
    this.cheeseOverlayMesh.position.y = 0.072;
    this.cheeseOverlayMesh.receiveShadow = true;
    this.wholeGroup.add(this.cheeseOverlayMesh);
  }

  _initCheeseStrands() {
    const strandMat = new THREE.MeshStandardMaterial({
      color: 0xffebb0,
      roughness: 0.25,
      metalness: 0.02
    });
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.CylinderGeometry(0.012, 0.018, 1, 6);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, strandMat);
      mesh.visible = false;
      this.strandsGroup.add(mesh);
      this.strands.push({
        mesh,
        anchorLocal: new THREE.Vector3(),
        tipOffset: new THREE.Vector3(),
        snapped: false,
        maxLen: 0.8 + i * 0.14
      });
    }
  }

  reset() {
    this.stretchProgress = 0;
    this.squashImpulse = 0;
    this.aspectBiasX = 1;
    this.aspectBiasZ = 1;
    this.bakeProgress = 0;
    this.lastBakedTexVal = -1;

    // Clear sauce & cheese canvases
    this.sauceCtx.clearRect(0, 0, 512, 512);
    this.sauceTex.needsUpdate = true;
    this.sauceGrid.fill(0);
    this.sauceCoverage = 0;

    this.cheeseCtx.clearRect(0, 0, 512, 512);
    this.cheeseTex.needsUpdate = true;
    this.cheeseOverlayMat.opacity = 0;

    // Clear toppings
    for (const t of this.toppings) {
      if (t.mesh.parent) t.mesh.parent.remove(t.mesh);
    }
    this.toppings.length = 0;

    // Clear cheese bubbles
    for (const b of this.cheeseBubbles) {
      this.bubblesGroup.remove(b.mesh);
    }
    this.cheeseBubbles.length = 0;

    // Clear slices
    while (this.slicesGroup.children.length > 0) {
      this.slicesGroup.remove(this.slicesGroup.children[0]);
    }
    this.slices.length = 0;
    this.cutStates = [false, false, false];
    this.slicesGroup.visible = false;
    this.wholeGroup.visible = true;
    this.hideCheeseStrands();

    // Reset topping materials to raw state
    this.mats.cheese.color.setHex(0xfdf4d8);
    this.mats.cheese.roughness = 0.78;
    this.mats.pepperoni.color.setHex(0xffffff);
    this.mats.pepperoni.roughness = 0.48;
    this.mats.corn.color.setHex(0xf5c838);
    this.mats.mushroom.color.setHex(0xffffff);
    this.mats.basil.color.setHex(0xffffff);
    this.doughMat.roughness = 0.9;

    this._updateDoughTexture(0);
    this._updateDoughGeometry();
  }

  _updateDoughTexture(bake) {
    if (Math.abs(bake - this.lastBakedTexVal) < 0.015) return;
    this.lastBakedTexVal = bake;
    const ctx = this.doughCtx;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.doughTexData.rawCanvas, 0, 0);
    if (bake > 0.01) {
      ctx.globalAlpha = Math.min(1, bake * 1.05);
      ctx.drawImage(this.doughTexData.bakedCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }
    this.doughTex.needsUpdate = true;
  }

  _updateDoughGeometry() {
    const pos = this.doughGeo.attributes.position;
    const p = this.stretchProgress;
    const bake = this.bakeProgress;

    // Smooth radius growth: 0.56 -> 1.15
    const curRadius = 0.56 + (PIZZA_FULL_RADIUS - 0.56) * p;
    const rx = curRadius * this.aspectBiasX;
    const rz = curRadius * this.aspectBiasZ;

    // Center thickness flattens from 0.36 -> 0.048 as dough is stretched
    const ballHeight = (1 - p) * 0.32 + 0.048;
    // Cornicione puffy outer rim forms as stretched, and PUFFS UP 1.85x in the brick oven!
    const rimHeight = (0.045 + p * 0.068) * (1 + bake * 0.88);
    const squish = 1 - this.squashImpulse * 0.22;

    let idx = 0;
    for (let r = 0; r <= this.rings; r++) {
      const rn = r / this.rings;
      for (let s = 0; s <= this.segs; s++) {
        const a = (s / this.segs) * Math.PI * 2;
        const organic = 1 + this.rimNoise[s] * (0.4 + p * 0.6 + bake * 0.5);

        let radFactor;
        let y;
        if (rn <= 0.92) {
          const u = rn / 0.92; // 0 center .. 1 outer rim crest
          radFactor = u;
          // Dome profile when unstretched (ball), flat center + puffy raised cornicione when stretched
          const domeY = Math.sqrt(Math.max(0.001, 1 - u * u * 0.92)) * ballHeight;
          const rimProfile = Math.exp(-Math.pow((u - 0.89) / 0.14, 2));
          // Extra puffy air bubbles in the baked rim
          const bakeBlister = bake * rimProfile * (0.028 + 0.025 * Math.sin(a * 7 + 0.5) * Math.cos(a * 4));
          const stretchedY = 0.046 + rimProfile * rimHeight + bakeBlister;
          y = THREE.MathUtils.lerp(domeY, stretchedY, Math.pow(p, 0.72));
          y *= squish;
        } else {
          // Smooth rounded side edge tucking neatly onto the pastry board
          const t = (rn - 0.92) / 0.08; // 0..1
          radFactor = 1.0 - t * 0.035;
          const edgeTop = THREE.MathUtils.lerp(ballHeight * 0.28, 0.046 + rimHeight * 0.45, p) * squish;
          y = edgeTop * (1 - t);
        }

        const vx = Math.cos(a) * rx * radFactor * organic;
        const vz = Math.sin(a) * rz * radFactor * organic;
        pos.setXYZ(idx, vx, Math.max(0.002, y), vz);
        idx++;
      }
    }

    pos.needsUpdate = true;
    this.doughGeo.computeVertexNormals();

    // Scale sauce & cheese overlays to track current pizza radius
    const scaleRatio = curRadius / PIZZA_FULL_RADIUS;
    this.sauceMesh.scale.set(scaleRatio * this.aspectBiasX, 1, scaleRatio * this.aspectBiasZ);
    this.cheeseOverlayMesh.scale.set(scaleRatio * this.aspectBiasX, 1, scaleRatio * this.aspectBiasZ);
    this.sauceMesh.visible = this.stretchProgress > 0.55;
  }

  // Called during Stage 1 when child drags rolling pin or taps/pats the dough
  stretchDough(amount, dirX = 0, dirZ = 0) {
    this.stretchProgress = Math.min(1, this.stretchProgress + amount);
    this.squashImpulse = Math.min(1, this.squashImpulse + 0.45);

    // Subtle realistic directional stretch along rolling axis, gently relaxing back to round near completion
    const dirLen = Math.hypot(dirX, dirZ);
    if (dirLen > 0.01 && this.stretchProgress < 0.88) {
      const nx = Math.abs(dirX) / dirLen;
      const nz = Math.abs(dirZ) / dirLen;
      this.aspectBiasX = THREE.MathUtils.clamp(this.aspectBiasX + (nx - nz) * 0.035, 0.9, 1.12);
      this.aspectBiasZ = THREE.MathUtils.clamp(this.aspectBiasZ + (nz - nx) * 0.035, 0.9, 1.12);
    }
    // Round out nicely near 100%
    if (this.stretchProgress > 0.72) {
      this.aspectBiasX = THREE.MathUtils.lerp(this.aspectBiasX, 1.0, 0.25);
      this.aspectBiasZ = THREE.MathUtils.lerp(this.aspectBiasZ, 1.0, 0.25);
    }
    this._updateDoughGeometry();
    return this.stretchProgress;
  }

  // Paint glossy tomato sauce onto the 512x512 dynamic canvas at local (x, z)
  paintSauce(localX, localZ, radiusWorld = 0.25) {
    const maxR = PIZZA_FULL_RADIUS * 0.84;
    const dist = Math.hypot(localX, localZ);
    if (dist > maxR * 1.05) return false;

    // Clamp softly inside crust rim
    let px = localX;
    let pz = localZ;
    if (dist > maxR * 0.9) {
      const scale = (maxR * 0.9) / dist;
      px *= scale;
      pz *= scale;
    }

    // World -> UV -> Canvas pixel
    const u = 0.5 + px / (PIZZA_FULL_RADIUS * 0.86 * 2);
    const v = 0.5 + pz / (PIZZA_FULL_RADIUS * 0.86 * 2);
    const cx = u * 512;
    const cy = v * 512;
    const radPx = (radiusWorld / (PIZZA_FULL_RADIUS * 0.86 * 2)) * 512;

    const ctx = this.sauceCtx;
    const grad = ctx.createRadialGradient(cx, cy, radPx * 0.15, cx, cy, radPx);
    grad.addColorStop(0, 'rgba(186, 26, 17, 0.92)');
    grad.addColorStop(0.65, 'rgba(170, 22, 14, 0.82)');
    grad.addColorStop(1, 'rgba(155, 20, 12, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
    ctx.fill();

    // Rich pulp flecks & aromatic oregano specks inside each brushstroke
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * radPx * 0.72;
      const sx = cx + Math.cos(a) * rr;
      const sy = cy + Math.sin(a) * rr;
      ctx.fillStyle = i === 0 ? 'rgba(42, 76, 28, 0.72)' : 'rgba(225, 62, 38, 0.55)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + Math.random() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    this.sauceTex.needsUpdate = true;

    // Update coverage grid
    const gN = this.sauceGridSize;
    let filled = 0;
    let totalInCircle = 0;
    for (let gy = 0; gy < gN; gy++) {
      for (let gx = 0; gx < gN; gx++) {
        const wx = ((gx + 0.5) / gN - 0.5) * maxR * 2;
        const wz = ((gy + 0.5) / gN - 0.5) * maxR * 2;
        if (Math.hypot(wx, wz) <= maxR * 0.88) {
          totalInCircle++;
          if (Math.hypot(wx - px, wz - pz) <= radiusWorld * 0.92) {
            this.sauceGrid[gy * gN + gx] = 1;
          }
          if (this.sauceGrid[gy * gN + gx]) filled++;
        }
      }
    }
    this.sauceCoverage = totalInCircle > 0 ? filled / totalInCircle : 0;
    return true;
  }

  // Paint a lush creamy melted-cheese puddle onto the hidden cheese blanket (revealed in oven!)
  _stampCheeseBlanket(localX, localZ) {
    const u = 0.5 + localX / (PIZZA_FULL_RADIUS * 0.85 * 2);
    const v = 0.5 + localZ / (PIZZA_FULL_RADIUS * 0.85 * 2);
    const cx = u * 512;
    const cy = v * 512;
    const rad = 68 + Math.random() * 24;

    const ctx = this.cheeseCtx;
    const grad = ctx.createRadialGradient(cx, cy, rad * 0.14, cx, cy, rad);
    grad.addColorStop(0, 'rgba(255, 241, 186, 0.98)');
    grad.addColorStop(0.55, 'rgba(254, 229, 152, 0.92)');
    grad.addColorStop(0.82, 'rgba(248, 212, 122, 0.65)');
    grad.addColorStop(1, 'rgba(244, 200, 110, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();

    // Organic melted mozzarella lobes & golden toasted blister spots
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * rad * 0.52;
      const bx = cx + Math.cos(a) * d;
      const by = cy + Math.sin(a) * d;
      const br = 6 + Math.random() * 10;
      const bGrad = ctx.createRadialGradient(bx, by, 1, bx, by, br);
      bGrad.addColorStop(0, 'rgba(186, 108, 32, 0.68)');
      bGrad.addColorStop(0.6, 'rgba(218, 146, 56, 0.35)');
      bGrad.addColorStop(1, 'rgba(218, 146, 56, 0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    this.cheeseTex.needsUpdate = true;
  }

  // Add a 3D topping at local (x, z) on the pizza surface
  addTopping(type, localX, localZ) {
    const maxR = PIZZA_FULL_RADIUS * 0.8;
    const d = Math.hypot(localX, localZ);
    let x = localX;
    let z = localZ;
    if (d > maxR) {
      x = (x / d) * maxR;
      z = (z / d) * maxR;
    }

    // Gentle performance cap so endless 5-year-old tapping stays silky >=30fps on iPhone/iPad
    if (this.toppings.length >= 240) {
      const oldest = this.toppings.shift();
      if (oldest && oldest.mesh.parent) oldest.mesh.parent.remove(oldest.mesh);
    }

    // Slight vertical stacking so multiple toppings layer naturally without z-fighting
    const baseY = 0.066 + Math.min(this.toppings.length * 0.0004, 0.026);
    const created = [];

    if (type === 'cheese') {
      this._stampCheeseBlanket(x, z);
      const count = 6;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.16;
        const sx = x + Math.cos(ang) * rad;
        const sz = z + Math.sin(ang) * rad;
        if (Math.hypot(sx, sz) > PIZZA_FULL_RADIUS * 0.84) continue;
        const m = new THREE.Mesh(this.cheeseShredGeo, this.mats.cheese);
        m.position.set(sx, baseY + 0.012 + Math.random() * 0.012, sz);
        m.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15);
        m.castShadow = true;
        this.toppingsGroup.add(m);
        const rec = {
          type: 'cheese',
          mesh: m,
          x: sx,
          z: sz,
          baseY: m.position.y,
          popAnim: 1.0
        };
        this.toppings.push(rec);
        created.push(rec);
      }
      // Spawn a subtle bubbling spot for the oven stage!
      if (this.cheeseBubbles.length < 18) {
        const bMesh = new THREE.Mesh(this.bubbleGeo, this.mats.bubble);
        bMesh.position.set(x, 0.068, z);
        bMesh.scale.set(0.001, 0.001, 0.001);
        this.bubblesGroup.add(bMesh);
        this.cheeseBubbles.push({
          mesh: bMesh,
          x,
          z,
          phase: Math.random() * Math.PI * 2,
          speed: 2.2 + Math.random() * 2.1
        });
      }
    } else if (type === 'corn') {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const rad = 0.02 + Math.random() * 0.11;
        const sx = x + Math.cos(ang) * rad;
        const sz = z + Math.sin(ang) * rad;
        if (Math.hypot(sx, sz) > PIZZA_FULL_RADIUS * 0.83) continue;
        const m = new THREE.Mesh(this.cornGeo, this.mats.corn);
        m.position.set(sx, baseY + 0.025, sz);
        m.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
        m.castShadow = true;
        this.toppingsGroup.add(m);
        const rec = { type: 'corn', mesh: m, x: sx, z: sz, baseY: m.position.y, popAnim: 1.0 };
        this.toppings.push(rec);
        created.push(rec);
      }
    } else if (type === 'pepperoni') {
      const m = new THREE.Mesh(this.pepGeo, this.mats.pepperoni);
      m.position.set(x, baseY + 0.015, z);
      m.rotation.y = Math.random() * Math.PI * 2;
      m.castShadow = true;
      m.receiveShadow = true;
      this.toppingsGroup.add(m);
      const rec = { type: 'pepperoni', mesh: m, x, z, baseY: m.position.y, popAnim: 1.0 };
      this.toppings.push(rec);
      created.push(rec);
    } else if (type === 'tomato') {
      const grp = new THREE.Group();
      // Plump glossy red cherry tomato half resting flat cut-side UP with seeded photographic cross-section!
      const skin = new THREE.Mesh(this.tomatoBodyGeo, this.mats.tomatoSkin);
      skin.position.y = 0.026;
      skin.castShadow = true;
      grp.add(skin);
      const cut = new THREE.Mesh(this.tomatoCutGeo, this.mats.tomatoInside);
      cut.position.y = 0.0535;
      grp.add(cut);
      grp.position.set(x, baseY + 0.006, z);
      grp.rotation.set((Math.random() - 0.5) * 0.14, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.14);
      this.toppingsGroup.add(grp);
      const rec = { type: 'tomato', mesh: grp, x, z, baseY: grp.position.y, popAnim: 1.0 };
      this.toppings.push(rec);
      created.push(rec);
    } else if (type === 'mushroom') {
      const m = new THREE.Mesh(this.mushGeo, this.mats.mushroom);
      m.position.set(x, baseY + 0.006, z);
      m.rotation.y = Math.random() * Math.PI * 2;
      m.castShadow = true;
      this.toppingsGroup.add(m);
      const rec = { type: 'mushroom', mesh: m, x, z, baseY: m.position.y, popAnim: 1.0 };
      this.toppings.push(rec);
      created.push(rec);
    } else if (type === 'basil') {
      const m = new THREE.Mesh(this.basilGeo, this.mats.basil);
      m.position.set(x, baseY + 0.02, z);
      m.rotation.y = Math.random() * Math.PI * 2;
      m.castShadow = true;
      this.toppingsGroup.add(m);
      const rec = { type: 'basil', mesh: m, x, z, baseY: m.position.y, popAnim: 1.0 };
      this.toppings.push(rec);
      created.push(rec);
    }

    return created;
  }

  getToppingCounts() {
    const counts = { total: 0, cheese: 0, pepperoni: 0, tomato: 0, corn: 0, mushroom: 0, basil: 0 };
    for (const t of this.toppings) {
      counts[t.type] = (counts[t.type] || 0) + 1;
      counts.total++;
    }
    return counts;
  }

  // Called continuously during Stage 4 (Oven Baking)
  setBakeProgress(p, elapsed = 0) {
    this.bakeProgress = THREE.MathUtils.clamp(p, 0, 1);
    const b = this.bakeProgress;

    this._updateDoughTexture(b);
    this._updateDoughGeometry();
    this.doughMat.roughness = THREE.MathUtils.lerp(0.9, 0.72, b);

    // Melted cheese blanket smoothly oozes into view where cheese was placed!
    this.cheeseOverlayMat.opacity = Math.min(0.96, Math.pow(b, 0.85) * 1.05);

    // Cheese shreds visibly melt, flatten, widen, and turn creamy-gold & glossy!
    this.mats.cheese.color.setRGB(
      THREE.MathUtils.lerp(0.99, 1.0, b),
      THREE.MathUtils.lerp(0.96, 0.88, b),
      THREE.MathUtils.lerp(0.85, 0.58, b)
    );
    this.mats.cheese.roughness = THREE.MathUtils.lerp(0.78, 0.2, b);

    // Pepperoni crisps & glistens slightly deeper red
    this.mats.pepperoni.roughness = THREE.MathUtils.lerp(0.48, 0.24, b);
    this.mats.pepperoni.color.setRGB(1, THREE.MathUtils.lerp(1, 0.86, b), THREE.MathUtils.lerp(1, 0.82, b));

    // Corn toasts slightly deeper golden
    this.mats.corn.color.setRGB(
      THREE.MathUtils.lerp(0.96, 0.94, b),
      THREE.MathUtils.lerp(0.78, 0.68, b),
      THREE.MathUtils.lerp(0.22, 0.14, b)
    );
    // Mushrooms & basil darken slightly from oven heat
    this.mats.mushroom.color.setRGB(
      THREE.MathUtils.lerp(1, 0.86, b),
      THREE.MathUtils.lerp(1, 0.76, b),
      THREE.MathUtils.lerp(1, 0.65, b)
    );
    this.mats.basil.color.setRGB(
      THREE.MathUtils.lerp(1, 0.78, b),
      THREE.MathUtils.lerp(1, 0.86, b),
      THREE.MathUtils.lerp(1, 0.72, b)
    );

    // Physical per-topping oven transformations
    for (const t of this.toppings) {
      if (t.type === 'cheese') {
        // Melt wide & flat!
        t.mesh.scale.set(1 + b * 0.95, 1 - b * 0.65, 1 + b * 1.15);
        t.mesh.position.y = t.baseY - b * 0.012;
      } else if (t.type === 'pepperoni') {
        // Slight crisp curling & subtle shrinkage
        t.mesh.scale.set(1 - b * 0.06, 1 + b * 0.35, 1 - b * 0.06);
      } else if (t.type === 'mushroom') {
        t.mesh.scale.set(1 - b * 0.08, 1 - b * 0.12, 1 - b * 0.08);
      }
    }

    // Animated bubbling melted cheese pockets!
    for (const bub of this.cheeseBubbles) {
      if (b < 0.25) {
        bub.mesh.scale.setScalar(0.001);
        continue;
      }
      const heat = (b - 0.25) / 0.75;
      const cycle = (elapsed * bub.speed + bub.phase) % (Math.PI * 2);
      const swell = Math.max(0, Math.sin(cycle));
      const s = (0.35 + swell * 1.05) * heat;
      bub.mesh.scale.set(s * 1.25, s * 0.75, s * 1.25);
    }
  }

  // Convert the baked whole pizza into 6 exact 3D wedges with every topping & exact sauce UVs preserved!
  prepareSlices() {
    while (this.slicesGroup.children.length > 0) {
      this.slicesGroup.remove(this.slicesGroup.children[0]);
    }
    this.slices.length = 0;
    this.cutStates = [false, false, false];

    // Inner flaky golden-bread crumb material for the exposed cut edges
    const crumbMat = new THREE.MeshStandardMaterial({
      color: 0xe3bf82,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

    const wedgeAngle = (Math.PI * 2) / SLICE_COUNT;
    const rings = 11;
    const segsPerWedge = 10;

    for (let i = 0; i < SLICE_COUNT; i++) {
      const a0 = i * wedgeAngle;
      const a1 = a0 + wedgeAngle;
      const midA = (a0 + a1) * 0.5;

      const sliceGrp = new THREE.Group();
      this.slicesGroup.add(sliceGrp);

      // Build exact puffed baked wedge mesh
      const geom = this._buildWedgeGeometry(a0, a1, rings, segsPerWedge);
      const crustMesh = new THREE.Mesh(geom, this.doughMat);
      crustMesh.castShadow = true;
      crustMesh.receiveShadow = true;
      sliceGrp.add(crustMesh);

      // Subtle inner cut-edge walls so lifted slices look chunky & real in 3D!
      const wallA = this._buildCutWall(a0, crumbMat);
      const wallB = this._buildCutWall(a1, crumbMat);
      sliceGrp.add(wallA);
      sliceGrp.add(wallB);

      // Wedge slice of the dynamic tomato sauce canvas (exact matching UV!)
      const sauceWedge = this._buildFlatWedgeOverlay(a0, a1, PIZZA_FULL_RADIUS * 0.86, 0.062, this.sauceMat);
      sliceGrp.add(sauceWedge);

      // Wedge slice of the melted golden cheese blanket (exact matching UV!)
      const cheeseWedge = this._buildFlatWedgeOverlay(a0, a1, PIZZA_FULL_RADIUS * 0.85, 0.072, this.cheeseOverlayMat);
      sliceGrp.add(cheeseWedge);

      const toppingSummary = { cheese: 0, pepperoni: 0, tomato: 0, corn: 0, mushroom: 0, basil: 0 };
      const sliceData = {
        index: i,
        group: sliceGrp,
        midAngle: midA,
        baseOffset: new THREE.Vector3(0, 0, 0),
        targetOffset: new THREE.Vector3(0, 0, 0),
        served: false,
        eaten: false,
        biteCount: 0,
        toppings: toppingSummary
      };
      this.slices.push(sliceData);
    }

    // Reparent every single 3D topping onto the exact wedge covering its (x, z) angle!
    for (const t of this.toppings) {
      let ang = Math.atan2(t.z, t.x);
      if (ang < 0) ang += Math.PI * 2;
      const idx = Math.floor(ang / wedgeAngle) % SLICE_COUNT;
      this.slices[idx].group.add(t.mesh);
      this.slices[idx].toppings[t.type] = (this.slices[idx].toppings[t.type] || 0) + 1;
    }

    // Also reparent cheese bubbles cleanly onto their wedges (frozen as crispy golden baked bubbles)
    for (const bub of this.cheeseBubbles) {
      let ang = Math.atan2(bub.z, bub.x);
      if (ang < 0) ang += Math.PI * 2;
      const idx = Math.floor(ang / wedgeAngle) % SLICE_COUNT;
      bub.mesh.scale.set(0.9, 0.45, 0.9);
      this.slices[idx].group.add(bub.mesh);
    }

    this.wholeGroup.visible = false;
    this.slicesGroup.visible = true;
  }

  _buildWedgeGeometry(a0, a1, rings, segs) {
    const vertCount = (rings + 1) * (segs + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    const bake = this.bakeProgress;
    const rimHeight = (0.045 + 0.068) * (1 + bake * 0.88);

    let idx = 0;
    for (let r = 0; r <= rings; r++) {
      const rn = r / rings;
      for (let s = 0; s <= segs; s++) {
        const a = a0 + (s / segs) * (a1 - a0);
        const organic =
          1 +
          (Math.sin(a * 5 + 0.4) * 0.015 +
            Math.cos(a * 9 - 0.8) * 0.009 +
            Math.sin(a * 13 + 1.5) * 0.006) *
            (1.0 + bake * 0.45);

        let radFactor;
        let y;
        if (rn <= 0.9) {
          const u = rn / 0.9;
          radFactor = u;
          const rimProfile = Math.exp(-Math.pow((u - 0.89) / 0.14, 2));
          const bakeBlister = bake * rimProfile * (0.028 + 0.025 * Math.sin(a * 7 + 0.5) * Math.cos(a * 4));
          y = 0.046 + rimProfile * rimHeight + bakeBlister;
        } else {
          const t = (rn - 0.9) / 0.1;
          radFactor = 1.0 - t * 0.035;
          y = (0.046 + rimHeight * 0.45) * (1 - t);
        }

        const vx = Math.cos(a) * PIZZA_FULL_RADIUS * radFactor * organic;
        const vz = Math.sin(a) * PIZZA_FULL_RADIUS * radFactor * organic;
        positions[idx * 3] = vx;
        positions[idx * 3 + 1] = Math.max(0.002, y);
        positions[idx * 3 + 2] = vz;

        const uTex = 0.5 + Math.cos(a) * Math.min(rn / 0.9, 1) * 0.495;
        const vTex = 0.5 + Math.sin(a) * Math.min(rn / 0.9, 1) * 0.495;
        uvs[idx * 2] = uTex;
        uvs[idx * 2 + 1] = 1 - vTex;
        idx++;
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s;
        const b = a + 1;
        const c = (r + 1) * (segs + 1) + s;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  _buildCutWall(angle, mat) {
    // True contoured bread cross-section following the exact dough & puffed cornicione height profile!
    const bake = this.bakeProgress;
    const rimHeight = (0.045 + 0.068) * (1 + bake * 0.88);
    const organic =
      1 +
      (Math.sin(angle * 5 + 0.4) * 0.015 +
        Math.cos(angle * 9 - 0.8) * 0.009 +
        Math.sin(angle * 13 + 1.5) * 0.006) *
        (1.0 + bake * 0.45);
    const steps = 14;
    const positions = [];
    const indices = [];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let i = 0; i <= steps; i++) {
      const u = i / steps; // 0 center .. 1 outer rim
      const r = u * PIZZA_FULL_RADIUS * organic;
      let topY;
      if (u <= 0.96) {
        const rimProfile = Math.exp(-Math.pow((u - 0.89) / 0.14, 2));
        const bakeBlister = bake * rimProfile * (0.028 + 0.025 * Math.sin(angle * 7 + 0.5) * Math.cos(angle * 4));
        // Tuck 0.003 below exact crust surface so it never z-fights through top crust/sauce!
        topY = Math.max(0.005, 0.043 + rimProfile * rimHeight + bakeBlister);
      } else {
        const t = (u - 0.96) / 0.04;
        topY = Math.max(0.004, (0.043 + rimHeight * 0.45) * (1 - t));
      }
      const x = cosA * r;
      const z = sinA * r;
      positions.push(x, 0.002, z);
      positions.push(x, topY, z);
    }

    for (let i = 0; i < steps; i++) {
      const b0 = i * 2;
      const t0 = b0 + 1;
      const b1 = b0 + 2;
      const t1 = b0 + 3;
      indices.push(b0, b1, t0);
      indices.push(t0, b1, t1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _buildFlatWedgeOverlay(a0, a1, radius, y, mat) {
    const segs = 8;
    const positions = [0, y, 0];
    const uvs = [0.5, 0.5];
    const indices = [];

    for (let s = 0; s <= segs; s++) {
      const a = a0 + (s / segs) * (a1 - a0);
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      positions.push(x, y, z);
      // Match CircleGeometry rotated -PI/2 around X:
      // CircleGeometry standard UV has u = 0.5 + cos(a)*0.5, v = 0.5 - sin(a)*0.5 when rotated -PI/2!
      uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5);
    }

    for (let s = 1; s <= segs; s++) {
      indices.push(0, s + 1, s);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // Apply one of the 3 diameter cuts (0: 0deg, 1: 60deg, 2: 120deg)
  applyCut(cutIdx) {
    if (cutIdx < 0 || cutIdx > 2 || this.cutStates[cutIdx]) return false;
    this.cutStates[cutIdx] = true;

    // Separate slices slightly along the normal of every completed cut!
    const cutAngles = [0, Math.PI / 3, (2 * Math.PI) / 3];
    for (const s of this.slices) {
      let ox = 0;
      let oz = 0;
      for (let c = 0; c < 3; c++) {
        if (!this.cutStates[c]) continue;
        const ca = cutAngles[c];
        const nx = -Math.sin(ca);
        const nz = Math.cos(ca);
        const side = Math.cos(s.midAngle) * nx + Math.sin(s.midAngle) * nz >= 0 ? 1 : -1;
        ox += nx * side * 0.038;
        oz += nz * side * 0.038;
      }
      s.targetOffset.set(ox, 0, oz);
    }
    return true;
  }

  allCutsDone() {
    return this.cutStates[0] && this.cutStates[1] && this.cutStates[2];
  }

  // Start gooey stretchy melted cheese strands when lifting a slice!
  beginCheeseStrands(sliceIdx) {
    const slice = this.slices[sliceIdx];
    if (!slice) return;
    const cheeseCount = slice.toppings.cheese || 0;
    const activeCount = Math.min(this.strands.length, 2 + Math.min(3, Math.ceil(cheeseCount / 3)));

    const midA = slice.midAngle;
    const perpA = midA + Math.PI / 2;

    for (let i = 0; i < this.strands.length; i++) {
      const st = this.strands[i];
      if (i < activeCount) {
        const r = 0.25 + (i / activeCount) * 0.55;
        const side = i % 2 === 0 ? 1 : -1;
        const ax = Math.cos(midA) * r + Math.cos(perpA) * side * 0.14;
        const az = Math.sin(midA) * r + Math.sin(perpA) * side * 0.14;
        st.anchorLocal.set(ax, 0.075, az);
        st.tipOffset.set(Math.cos(midA) * r, 0.075, Math.sin(midA) * r);
        st.snapped = false;
        st.maxLen = (0.72 + i * 0.14) * (cheeseCount > 4 ? 1.3 : 1.0);
        st.mesh.visible = true;
      } else {
        st.snapped = true;
        st.mesh.visible = false;
      }
    }
  }

  // Update stretchy cheese strands between board anchor & lifted slice position; returns true if any snapped!
  updateCheeseStrands(sliceOffsetLocal) {
    let snappedAny = false;
    const tmpEnd = new THREE.Vector3();
    for (const st of this.strands) {
      if (st.snapped || !st.mesh.visible) continue;
      tmpEnd.copy(st.tipOffset).add(sliceOffsetLocal);
      const dist = st.anchorLocal.distanceTo(tmpEnd);
      if (dist > st.maxLen) {
        st.snapped = true;
        st.mesh.visible = false;
        snappedAny = true;
        continue;
      }
      st.mesh.position.copy(st.anchorLocal);
      st.mesh.lookAt(this.group.localToWorld(tmpEnd.clone()));
      const thin = Math.max(0.28, 1 - (dist / st.maxLen) * 0.72);
      st.mesh.scale.set(thin, thin, Math.max(0.01, dist));
    }
    return snappedAny;
  }

  hideCheeseStrands() {
    for (const st of this.strands) {
      st.snapped = true;
      st.mesh.visible = false;
    }
  }

  update(dt) {
    // Elastic dough rebound
    if (this.squashImpulse > 0.001) {
      this.squashImpulse = Math.max(0, this.squashImpulse - dt * 4.2);
      this._updateDoughGeometry();
    }

    // Smooth pop-in animation for freshly placed toppings
    for (const t of this.toppings) {
      if (t.popAnim > 0) {
        t.popAnim = Math.max(0, t.popAnim - dt * 6.5);
        const bounce = 1 + Math.sin(t.popAnim * Math.PI) * 0.28;
        if (this.bakeProgress < 0.01) {
          t.mesh.scale.setScalar(bounce);
        }
        t.mesh.position.y = t.baseY + Math.sin(t.popAnim * Math.PI) * 0.055;
      }
    }

    // Smoothly slide cut slices slightly apart
    if (this.slicesGroup.visible) {
      const k = 1 - Math.exp(-dt * 11);
      for (const s of this.slices) {
        if (!s.served && !s.isDragging) {
          s.baseOffset.lerp(s.targetOffset, k);
          s.group.position.copy(s.baseOffset);
        }
      }
    }
  }
}
