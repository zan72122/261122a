import * as THREE from '../vendor/three.module.js';
import { createRoundedRectShape, extrudePaperFlat, createScallopedShape } from './shapes.js';

export function buildPapercraftWorld(scene, mats) {
  scene.background = new THREE.Color('#e6dfd3');
  scene.fog = new THREE.Fog('#e6dfd3', 18, 34);

  // Warm studio paper-diorama lighting
  const hemi = new THREE.HemisphereLight('#fffaf0', '#d6b692', 1.05);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight('#fff5e4', 1.65);
  keyLight.position.set(4.5, 9.5, 5.2);
  keyLight.castShadow = true;
  // Strictly <= 1024px shadow map for crisp iPad/iPhone performance
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 22;
  const d = 6.8;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.018;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#ffe4d6', 0.55);
  fillLight.position.set(-5.5, 5.0, 3.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#e8f4ff', 0.35);
  rimLight.position.set(-2.0, 6.0, -6.0);
  scene.add(rimLight);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // 1. Kraft-paper craft tabletop (layered slabs with crisp cut paper edge)
  const tableGeo = new THREE.BoxGeometry(16, 0.55, 10);
  const table = new THREE.Mesh(tableGeo, mats.kraftMat);
  table.position.set(0, -0.275, 0.3);
  table.receiveShadow = true;
  worldGroup.add(table);

  // Crisp paper trim along table front edge (layered papercraft detail)
  const trimGeo = new THREE.BoxGeometry(16.05, 0.08, 0.08);
  const trim = new THREE.Mesh(trimGeo, mats.paper('#f7ecd8'));
  trim.position.set(0, -0.04, 5.31);
  worldGroup.add(trim);

  // 2. Layered Gingham Craft Mat resting on tabletop
  const matBorderShape = createRoundedRectShape(8.6, 5.8, 0.36);
  const matBorderGeo = extrudePaperFlat(matBorderShape, 0.024, 0.006);
  const matBorder = new THREE.Mesh(matBorderGeo, mats.layered('#fff8ee', 0.3));
  matBorder.position.set(0, 0.002, 0.45);
  matBorder.receiveShadow = true;
  worldGroup.add(matBorder);

  const matInnerGeo = new THREE.BoxGeometry(8.2, 0.022, 5.4);
  const matInner = new THREE.Mesh(matInnerGeo, mats.ginghamMat);
  matInner.position.set(0, 0.022, 0.45);
  matInner.receiveShadow = true;
  worldGroup.add(matInner);

  // 3. Shadow-box Papercraft Kitchen Back Wall (strictly behind oven!)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 8.5, 0.25), mats.wallpaperMat);
  backWall.position.set(0, 3.8, -4.55);
  backWall.receiveShadow = true;
  worldGroup.add(backWall);

  // Wainscoting lower paper panel (stepped out slightly for shadow-box depth)
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(20, 1.45, 0.12), mats.paper('#f7ede0'));
  wainscot.position.set(0, 0.72, -4.39);
  wainscot.receiveShadow = true;
  worldGroup.add(wainscot);

  const dadoRail = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 0.2), mats.paper('#e6c5a3'));
  dadoRail.position.set(0, 1.48, -4.33);
  dadoRail.castShadow = true;
  worldGroup.add(dadoRail);

  // 4. Layered Cut-Paper Arch Window on back-right wall (true shadow-box depth!)
  const windowGroup = new THREE.Group();
  windowGroup.position.set(3.65, 2.75, -4.32);
  worldGroup.add(windowGroup);

  const skyBack = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.7), mats.paper('#bce0ee', { roughness: 0.95 }));
  skyBack.position.z = -0.05;
  windowGroup.add(skyBack);

  // Layered paper sun & clouds inside the shadow-box window
  const sunGeo = extrudePaperFlat(createScallopedShape(0.34, 12, 0.055), 0.03, 0.004);
  sunGeo.rotateX(Math.PI / 2);
  const sun = new THREE.Mesh(sunGeo, mats.layered('#ffd76a', 0.6));
  sun.position.set(0.52, 0.58, 0.02);
  windowGroup.add(sun);

  const cloud1 = buildPaperCloud(mats, 0.65);
  cloud1.position.set(-0.45, 0.28, 0.07);
  windowGroup.add(cloud1);

  const cloud2 = buildPaperCloud(mats, 0.52);
  cloud2.position.set(0.32, -0.25, 0.11);
  windowGroup.add(cloud2);

  // Window frame (cut-paper mullions)
  const frameColor = mats.paper('#fff7ea');
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.22, 0.16), frameColor);
  frameTop.position.set(0, 1.38, 0.16);
  windowGroup.add(frameTop);

  const frameBot = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.24, 0.24), frameColor);
  frameBot.position.set(0, -1.35, 0.2);
  frameBot.castShadow = true;
  windowGroup.add(frameBot);

  for (const sx of [-1.32, 0, 1.32]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sx === 0 ? 0.12 : 0.22, 2.75, 0.16), frameColor);
    bar.position.set(sx, 0.02, 0.16);
    windowGroup.add(bar);
  }
  const midBar = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.12, 0.16), frameColor);
  midBar.position.set(0, 0.05, 0.16);
  windowGroup.add(midBar);

  // Scalloped paper valance at top of window
  const valanceColor = mats.layered('#f28c88', 0.6);
  for (let i = 0; i < 6; i++) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14), valanceColor[0]);
    sc.rotation.x = Math.PI / 2;
    sc.position.set(-1.12 + i * 0.45, 1.18, 0.24);
    windowGroup.add(sc);
  }

  // 5. Papercraft Wooden Bakery Shelf on back-left wall (strictly clear of oven!)
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(-4.35, 2.52, -4.22);
  worldGroup.add(shelfGroup);

  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.58), mats.paper('#d4a373'));
  shelfBoard.castShadow = true;
  shelfBoard.receiveShadow = true;
  shelfGroup.add(shelfBoard);

  // Paper shelf brackets
  for (const bx of [-1.55, 1.55]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.44), mats.paper('#c28f5f'));
    br.position.set(bx, -0.28, -0.04);
    shelfGroup.add(br);
  }

  // Decorative tiny paper flour jar & whisk silhouettes on far-left of shelf so it looks lived-in
  const decoJar = new THREE.Group();
  decoJar.position.set(-1.82, 0.08, -0.06);
  const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.44, 10), mats.paper('#fff7ec'));
  jarBody.position.y = 0.22;
  const jarBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.15, 10), mats.paper('#83c8b9'));
  jarBand.position.y = 0.22;
  const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 10), mats.paper('#e68778'));
  jarLid.position.y = 0.48;
  decoJar.add(jarBody, jarBand, jarLid);
  shelfGroup.add(decoJar);

  // Container for trophy Gift Boxes earned by the player!
  const trophyShelfGroup = new THREE.Group();
  trophyShelfGroup.position.set(-0.92, 0.08, 0.04);
  shelfGroup.add(trophyShelfGroup);

  // 6. Overhead Cut-Paper Bunting Garland (bounces during celebrations!)
  const buntingGroup = new THREE.Group();
  buntingGroup.position.set(0, 4.45, -3.45);
  worldGroup.add(buntingGroup);

  const flagColors = ['#f26d85', '#ffd24c', '#5fd0b8', '#7fa8e8', '#f5986e', '#b68de8'];
  const flags = [];
  const flagCount = 13;
  for (let i = 0; i < flagCount; i++) {
    const u = i / (flagCount - 1) - 0.5;
    const x = u * 11.2;
    const sag = -Math.cos(u * Math.PI) * 0.68;

    const triShape = new THREE.Shape();
    triShape.moveTo(-0.34, 0);
    triShape.lineTo(0.34, 0);
    triShape.lineTo(0, -0.64);
    triShape.closePath();

    const triGeo = extrudePaperFlat(triShape, 0.025, 0.005);
    triGeo.rotateX(Math.PI / 2);

    const flag = new THREE.Mesh(triGeo, mats.layered(flagColors[i % flagColors.length], 0.65));
    flag.position.set(x, sag, 0);
    flag.userData.baseRotZ = u * 0.35;
    flag.rotation.z = flag.userData.baseRotZ;
    buntingGroup.add(flag);
    flags.push(flag);
  }

  return {
    worldGroup,
    trophyShelfGroup,
    buntingGroup,
    flags,
    sun,
    cloud1,
    cloud2,
    updateAmbient(t, celebrateEnergy = 0) {
      sun.rotation.z = t * 0.14;
      cloud1.position.x = -0.45 + Math.sin(t * 0.35) * 0.12;
      cloud2.position.x = 0.32 + Math.cos(t * 0.28) * 0.1;

      const swayAmp = 0.04 + celebrateEnergy * 0.24;
      const swayFreq = 1.6 + celebrateEnergy * 6.0;
      for (let i = 0; i < flags.length; i++) {
        const f = flags[i];
        f.rotation.x = Math.sin(t * swayFreq + i * 0.6) * swayAmp;
        f.rotation.z = f.userData.baseRotZ + Math.cos(t * (swayFreq * 0.7) + i) * (swayAmp * 0.45);
      }
    },
  };
}

function buildPaperCloud(mats, scale = 1) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.absarc(-0.38, 0, 0.3, 0, Math.PI * 2, false);
  const geo1 = extrudePaperFlat(s, 0.03, 0.004);
  geo1.rotateX(Math.PI / 2);
  const m = mats.layered('#fffcf7', 0.4);
  const p1 = new THREE.Mesh(geo1, m);
  const p2 = new THREE.Mesh(geo1, m);
  p2.position.set(0.36, 0.12, 0);
  p2.scale.setScalar(1.22);
  const p3 = new THREE.Mesh(geo1, m);
  p3.position.set(0.75, -0.02, 0);
  p3.scale.setScalar(0.95);
  g.add(p1, p2, p3);
  g.scale.setScalar(scale);
  return g;
}
