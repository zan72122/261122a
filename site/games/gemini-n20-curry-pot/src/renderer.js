// High-speed 60fps Sprite-Stacking Renderer with GPU-accelerated crisp 1px #381F15 pixel outlines & exact 360° topological depth sorting
window.Renderer = (() => {
  const P = window.PAL;
  const CU = window.ColorUtil;

  const SQUASH = 0.56;
  const SLICE_STEP = 1.0;

  // Offscreen low-res crisp pixel buffer + reusable scratch canvases for GPU outline pass
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { alpha: false });

  const propBuf = document.createElement('canvas');
  propBuf.width = 180;
  propBuf.height = 160;
  const pctx = propBuf.getContext('2d');

  const tintBuf = document.createElement('canvas');
  tintBuf.width = 180;
  tintBuf.height = 160;
  const tctx = tintBuf.getContext('2d');

  let viewW = 240;
  let viewH = 180;
  let originX = 120;
  let originY = 104;
  let camAngle = Math.PI * 0.25; // 45° classic isometric view matching ref_front_iso.jpg
  let cosA = Math.cos(camAngle);
  let sinA = Math.sin(camAngle);
  let screenScale = 1;
  let screenOffX = 0;
  let screenOffY = 0;

  function resize(mainCanvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    mainCanvas.width = Math.max(1, Math.round(cssW * dpr));
    mainCanvas.height = Math.max(1, Math.round(cssH * dpr));

    const aspect = cssW / Math.max(1, cssH);
    if (aspect >= 1.0) {
      // Landscape / 4:3 / iPad / Desktop: lush chunky zoom (~78% frame fill matching ref_front_iso.jpg!)
      viewH = 144;
      viewW = Math.max(176, Math.round(viewH * aspect));
      originX = Math.round(viewW * 0.5);
      originY = Math.round(viewH * 0.59);
    } else {
      // Portrait / iPhone: full diorama width fills ~92% cleanly with ample spin space above & below!
      viewW = 152;
      viewH = Math.max(210, Math.round(viewW / aspect));
      originX = Math.round(viewW * 0.5);
      originY = Math.round(viewH * 0.55);
    }

    buf.width = viewW;
    buf.height = viewH;
    bctx.imageSmoothingEnabled = false;
    pctx.imageSmoothingEnabled = false;
    tctx.imageSmoothingEnabled = false;

    screenScale = Math.min(cssW / viewW, cssH / viewH);
    screenOffX = (cssW - viewW * screenScale) * 0.5;
    screenOffY = (cssH - viewH * screenScale) * 0.5;
  }

  function setCamera(angle) {
    camAngle = angle;
    cosA = Math.cos(angle);
    sinA = Math.sin(angle);
  }

  function project(wx, wy, wz = 0) {
    const sx = originX + (wx * cosA - wy * sinA);
    const sy = originY + (wx * sinA + wy * cosA) * SQUASH - wz * SLICE_STEP;
    return { x: sx, y: sy };
  }

  // Inverse project CSS screen coordinates to world (wx, wy) on horizontal plane wz
  function screenToWorld(cssX, cssY, wz = 8) {
    const bx = (cssX - screenOffX) / screenScale;
    const by = (cssY - screenOffY) / screenScale;
    const rx = bx - originX;
    const ry = (by - originY + wz * SLICE_STEP) / SQUASH;
    const wx = rx * cosA + ry * sinA;
    const wy = -rx * sinA + ry * cosA;
    return { x: wx, y: wy, bx, by };
  }

  function worldToScreenCss(wx, wy, wz = 0) {
    const p = project(wx, wy, wz);
    return {
      x: screenOffX + p.x * screenScale,
      y: screenOffY + p.y * screenScale,
    };
  }

  function depthOf(wx, wy) {
    return wx * sinA + wy * cosA;
  }

  // Exact topological painter's sort for disjoint axis-aligned world footprints
  // Guarantees ZERO sorting glitches across all 360° of rotation!
  function sortClusters(clusters) {
    const n = clusters.length;
    const vx = sinA;
    const vy = cosA;
    const adj = Array.from({ length: n }, () => []);
    const indeg = new Int32Array(n);

    for (let i = 0; i < n; i++) {
      const a = clusters[i];
      for (let j = i + 1; j < n; j++) {
        const b = clusters[j];
        let aBeforeB = false;
        let bBeforeA = false;
        // Separated along X?
        if (a.x1 <= b.x0) {
          if (vx >= 0) aBeforeB = true;
          else bBeforeA = true;
        } else if (b.x1 <= a.x0) {
          if (vx >= 0) bBeforeA = true;
          else aBeforeB = true;
        }
        // Separated along Y?
        if (a.y1 <= b.y0) {
          if (vy >= 0) aBeforeB = true;
          else bBeforeA = true;
        } else if (b.y1 <= a.y0) {
          if (vy >= 0) bBeforeA = true;
          else aBeforeB = true;
        }
        if (aBeforeB && !bBeforeA) {
          adj[i].push(j);
          indeg[j]++;
        } else if (bBeforeA && !aBeforeB) {
          adj[j].push(i);
          indeg[i]++;
        }
      }
    }

    // Kahn's topological sort with depth tie-breaker
    const result = [];
    const ready = [];
    for (let i = 0; i < n; i++) {
      if (indeg[i] === 0) ready.push(i);
    }
    while (ready.length > 0) {
      ready.sort((ia, ib) => clusters[ia].depth - clusters[ib].depth);
      const u = ready.shift();
      result.push(clusters[u]);
      for (const v of adj[u]) {
        indeg[v]--;
        if (indeg[v] === 0) ready.push(v);
      }
    }
    // Fallback if any cycle ever happened
    if (result.length < n) {
      const seen = new Set(result);
      const rest = clusters.filter((c) => !seen.has(c)).sort((a, b) => a.depth - b.depth);
      result.push(...rest);
    }
    return result;
  }

  // Stamp propBuf (region 0..bw, 0..bh) onto bctx at (dstX, dstY) with crisp 1px #381F15 pixel outline!
  function stampWithOutline(bw, bh, dstX, dstY, outlineColor = P.outline) {
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, bw, bh);
    tctx.drawImage(propBuf, 0, 0, bw, bh, 0, 0, bw, bh);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = outlineColor;
    tctx.fillRect(0, 0, bw, bh);
    tctx.globalCompositeOperation = 'source-over';

    const ix = Math.round(dstX);
    const iy = Math.round(dstY);
    bctx.drawImage(tintBuf, 0, 0, bw, bh, ix - 1, iy, bw, bh);
    bctx.drawImage(tintBuf, 0, 0, bw, bh, ix + 1, iy, bw, bh);
    bctx.drawImage(tintBuf, 0, 0, bw, bh, ix, iy - 1, bw, bh);
    bctx.drawImage(tintBuf, 0, 0, bw, bh, ix, iy + 1, bw, bh);
    bctx.drawImage(propBuf, 0, 0, bw, bh, ix, iy, bw, bh);
  }

  // Render a sprite-stacked voxel model with optional rotation, squash/stretch, and crisp 1px dark outline
  function drawModel(model, wx, wy, wz, opts = {}) {
    const p = project(wx, wy, wz);
    const localRot = opts.rot || 0;
    const scaleX = opts.scaleX || 1;
    const scaleY = opts.scaleY || 1;
    const scaleZ = opts.scaleZ || 1;
    const outline = opts.outline !== false;

    const diag = Math.ceil(Math.hypot(model.w * scaleX, model.d * scaleY));
    const bw = Math.min(propBuf.width, diag + 10);
    const bh = Math.min(propBuf.height, Math.ceil(diag * SQUASH + model.h * SLICE_STEP * scaleZ) + 12);
    const ox = Math.floor(bw * 0.5);
    const oy = Math.floor(bh - diag * SQUASH * 0.5 - 5);

    if (!outline) {
      for (let z = 0; z < model.h; z++) {
        const sl = model.slices[z];
        if (!sl) continue;
        bctx.save();
        bctx.translate(Math.round(p.x), Math.round(p.y - z * SLICE_STEP * scaleZ));
        bctx.scale(scaleX, SQUASH * scaleY);
        bctx.rotate(camAngle + localRot);
        bctx.drawImage(sl, -model.cx, -model.cy);
        bctx.restore();
      }
      return;
    }

    pctx.clearRect(0, 0, bw, bh);
    for (let z = 0; z < model.h; z++) {
      const sl = model.slices[z];
      if (!sl) continue;
      pctx.save();
      pctx.translate(ox, oy - z * SLICE_STEP * scaleZ);
      pctx.scale(scaleX, SQUASH * scaleY);
      pctx.rotate(camAngle + localRot);
      pctx.drawImage(sl, -model.cx, -model.cy);
      pctx.restore();
    }

    stampWithOutline(bw, bh, p.x - ox, p.y - oy, opts.outlineColor || P.outline);
  }

  // Draw soft ellipse contact shadow on a surface
  function drawShadow(wx, wy, wz, rx, ry, alpha = 0.24) {
    const p = project(wx, wy, wz);
    bctx.save();
    bctx.translate(Math.round(p.x), Math.round(p.y));
    bctx.scale(1, SQUASH);
    bctx.fillStyle = `rgba(56, 31, 21, ${alpha})`;
    bctx.beginPath();
    bctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
  }

  // Draw animated dancing blue gas flames under the curry pot!
  function drawFlames(wx, wy, wz, heatLevel, t) {
    if (heatLevel <= 0) return;
    const count = heatLevel === 2 ? 12 : 8;
    const radius = 7.4;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.sin(t * 9 + i) * 0.14;
      const fx = wx + Math.cos(a) * radius;
      const fy = wy + Math.sin(a) * radius;
      const p = project(fx, fy, wz);
      const flick = Math.sin(t * (14 + (i % 3) * 4) + i * 2.1);
      const h = (heatLevel === 2 ? 4.8 : 3.0) + flick * 1.2;
      const ix = Math.round(p.x);
      const iy = Math.round(p.y);
      bctx.fillStyle = P.flameOuter;
      bctx.fillRect(ix - 1, Math.round(iy - h), 3, Math.max(2, Math.round(h + 1)));
      bctx.fillStyle = P.flameMid;
      bctx.fillRect(ix, Math.round(iy - h * 0.78), 2, Math.max(1, Math.round(h * 0.75)));
      bctx.fillStyle = P.flameCore;
      bctx.fillRect(ix, iy - 1, 1, 2);
    }
  }

  // Hero renderer: Cherry-red enamel curry pot with dynamic swirling liquid, bobbing 3D veggies, melting roux & ladle!
  function drawCurryPot(models, state, wx, wy, wz, t) {
    const pot = state.pot;
    const model = models.pot;
    const p = project(wx, wy, wz);
    const bw = 68, bh = 60;
    const ox = 34, oy = 42;
    pctx.clearRect(0, 0, bw, bh);

    // 1. Bottom & lower pot wall slices (z = 0..7)
    for (let z = 0; z <= 7; z++) {
      const sl = model.slices[z];
      if (!sl) continue;
      pctx.save();
      pctx.translate(ox, oy - z * SLICE_STEP);
      pctx.scale(1, SQUASH);
      pctx.rotate(camAngle);
      pctx.drawImage(sl, -model.cx, -model.cy);
      pctx.restore();
    }

    // 2. Dynamic shimmering curry/broth surface inside the wider pot at z = 7.6!
    const liquidZ = 7.6 + Math.sin(t * 4) * (state.stoveHeat > 0 ? 0.22 : 0.05);
    const cols = CU.curryColors(pot.rouxMelted, pot.veggieStock);
    pctx.save();
    pctx.translate(ox, oy - liquidZ * SLICE_STEP);
    pctx.scale(1, SQUASH);

    // Main circular broth/curry body (wide r = 8.6 matching wider pot!)
    pctx.fillStyle = cols.main;
    pctx.beginPath();
    pctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    pctx.fill();

    // Inner darker depth ring near pot wall
    pctx.strokeStyle = cols.dark;
    pctx.lineWidth = 1.4;
    pctx.beginPath();
    pctx.arc(0, 0, 7.9, 0, Math.PI * 2);
    pctx.stroke();

    // Velvety swirling sheen ripples when stirring or rich curry!
    const swirlA = pot.stirAngle + camAngle;
    pctx.strokeStyle = cols.hi;
    pctx.lineWidth = 1.2;
    for (let s = 0; s < 2; s++) {
      const sa = swirlA + s * Math.PI;
      pctx.beginPath();
      pctx.arc(0, 0, 3.6 + s * 2.1, sa, sa + 1.65);
      pctx.stroke();
    }

    // Active melting roux cocoa-amber ribbons blooming outward!
    for (const m of pot.meltingRoux) {
      const rx = m.lx * cosA - m.ly * sinA;
      const ry = m.lx * sinA + m.ly * cosA;
      const bloomR = 2.0 + m.progress * 5.8;
      pctx.strokeStyle = '#7A3B12';
      pctx.lineWidth = 1.6;
      pctx.beginPath();
      pctx.arc(rx, ry, Math.min(7.2, bloomR), t * 3, t * 3 + Math.PI * 1.4);
      pctx.stroke();
    }

    // Floating chunky 3D veggies bobbing & orbiting smoothly!
    const vegSorted = pot.floatingVeggies.map((v) => {
      const vx = Math.cos(v.angle + pot.stirAngle) * v.dist;
      const vy = Math.sin(v.angle + pot.stirAngle) * v.dist;
      return {
        v,
        px: vx * cosA - vy * sinA,
        py: vx * sinA + vy * cosA,
      };
    }).sort((a, b) => a.py - b.py);

    for (const item of vegSorted) {
      const { v, px, py } = item;
      const bob = Math.sin(t * (3.5 + state.stoveHeat * 1.5) + v.phase) * 0.55;
      const ix = Math.round(px);
      const iy = Math.round(py - bob);
      // Dark crisp rim dot + vibrant veggie pixel chunk!
      pctx.fillStyle = P.outline;
      pctx.fillRect(ix - 1, iy - 1, 3, 3);
      if (v.type === 'carrot') {
        pctx.fillStyle = P.carrotMain;
        pctx.fillRect(ix - 1, iy - 1, 2, 2);
        pctx.fillStyle = P.carrotLight;
        pctx.fillRect(ix - 1, iy - 1, 1, 1);
      } else if (v.type === 'potato') {
        pctx.fillStyle = P.potatoLight;
        pctx.fillRect(ix - 1, iy - 1, 2, 2);
        pctx.fillStyle = P.potatoInside;
        pctx.fillRect(ix - 1, iy - 1, 1, 1);
      } else if (v.type === 'onion') {
        pctx.fillStyle = P.onionInside;
        pctx.fillRect(ix - 1, iy - 1, 2, 2);
      } else {
        pctx.fillStyle = P.brocMid;
        pctx.fillRect(ix - 1, iy - 1, 2, 2);
        pctx.fillStyle = P.brocLight;
        pctx.fillRect(ix, iy - 1, 1, 1);
      }
    }

    // Floating melting roux cubes shrinking into curry!
    for (const m of pot.meltingRoux) {
      const rx = m.lx * cosA - m.ly * sinA;
      const ry = m.lx * sinA + m.ly * cosA;
      const sz = Math.max(1, Math.round((1 - m.progress) * 4));
      pctx.fillStyle = P.rouxDark;
      pctx.fillRect(Math.round(rx - sz * 0.5) - 1, Math.round(ry - sz * 0.5) - 1, sz + 1, sz + 1);
      pctx.fillStyle = P.rouxLight;
      pctx.fillRect(Math.round(rx - sz * 0.5), Math.round(ry - sz * 0.5), sz, sz);
    }

    // Simmering bubbles (faster & smaller in water, thicker & glossier in rich curry!)
    for (const b of pot.bubbles) {
      const bx = b.lx * cosA - b.ly * sinA;
      const by = b.lx * sinA + b.ly * cosA;
      const r = 0.8 + Math.sin(b.age * Math.PI) * (1.05 + pot.rouxMelted * 0.22);
      pctx.fillStyle = cols.hi;
      pctx.beginPath();
      pctx.arc(bx, by, r, 0, Math.PI * 2);
      pctx.fill();
      if (r > 1.2) {
        pctx.fillStyle = '#FFFDF5';
        pctx.fillRect(Math.round(bx - 0.5), Math.round(by - 0.5), 1, 1);
      }
    }
    pctx.restore();

    // 3. Upper pot rim & handles (z = 8..10) cleanly wrapping around the liquid!
    for (let z = 8; z < model.h; z++) {
      const sl = model.slices[z];
      if (!sl) continue;
      pctx.save();
      pctx.translate(ox, oy - z * SLICE_STEP);
      pctx.scale(1, SQUASH);
      pctx.rotate(camAngle);
      pctx.drawImage(sl, -model.cx, -model.cy);
      pctx.restore();
    }

    // 4. Wooden Ladle resting / stirring inside the pot (unless currently lifted to pour!)
    if (!state.ladleLifted) {
      const ladleModel = models.ladle;
      const stirOffset = pot.stirSpeed > 0.05 ? Math.sin(pot.stirAngle * 2) * 0.8 : 0;
      const la = pot.ladleAngle;
      for (let z = 0; z < ladleModel.h; z++) {
        const sl = ladleModel.slices[z];
        if (!sl) continue;
        pctx.save();
        pctx.translate(ox, oy - (7 + z * 0.92 + stirOffset) * SLICE_STEP);
        pctx.scale(1, SQUASH);
        pctx.rotate(camAngle + la);
        pctx.drawImage(sl, -4.5, -ladleModel.cy);
        pctx.restore();
      }
    }

    // Apply crisp 1px #381F15 outline around the whole pot + ladle!
    stampWithOutline(bw, bh, p.x - ox, p.y - oy);
  }

  // Draw pixel particles (steam, aroma curls, splashes, chop sparkles, hearts, stars!)
  function drawParticles(particles) {
    for (const pt of particles) {
      const p = project(pt.wx, pt.wy, pt.wz);
      const ix = Math.round(p.x);
      const iy = Math.round(p.y);
      const alpha = Math.max(0, Math.min(1, pt.alpha));
      bctx.save();
      bctx.globalAlpha = alpha;

      if (pt.kind === 'steam') {
        const r = Math.max(1, Math.round(pt.size));
        bctx.fillStyle = pt.color || '#FFFDF6';
        bctx.fillRect(ix - r, iy - r + 1, r * 2 + 1, r * 2 - 1);
        bctx.fillRect(ix - r + 1, iy - r, r * 2 - 1, r * 2 + 1);
      } else if (pt.kind === 'heart') {
        // Cute 5x5 pixel red heart with dark outline!
        bctx.fillStyle = P.outline;
        bctx.fillRect(ix - 3, iy - 2, 7, 3);
        bctx.fillRect(ix - 2, iy + 1, 5, 1);
        bctx.fillRect(ix - 1, iy + 2, 3, 1);
        bctx.fillStyle = pt.color || '#EF4254';
        bctx.fillRect(ix - 2, iy - 2, 2, 2);
        bctx.fillRect(ix + 1, iy - 2, 2, 2);
        bctx.fillRect(ix - 2, iy - 1, 5, 2);
        bctx.fillRect(ix - 1, iy + 1, 3, 1);
        bctx.fillRect(ix, iy + 2, 1, 1);
        bctx.fillStyle = '#FF99A4';
        bctx.fillRect(ix - 2, iy - 2, 1, 1);
      } else if (pt.kind === 'star') {
        bctx.fillStyle = P.outline;
        bctx.fillRect(ix - 1, iy - 3, 3, 7);
        bctx.fillRect(ix - 3, iy - 1, 7, 3);
        bctx.fillStyle = pt.color || '#FFE359';
        bctx.fillRect(ix, iy - 2, 1, 5);
        bctx.fillRect(ix - 2, iy, 5, 1);
        bctx.fillStyle = '#FFFDF0';
        bctx.fillRect(ix, iy, 1, 1);
      } else {
        // Crisp pixel drop / crumb / juice sparkle
        const s = Math.max(1, Math.round(pt.size));
        bctx.fillStyle = P.outline;
        bctx.fillRect(ix - 1, iy - 1, s + 2, s + 2);
        bctx.fillStyle = pt.color;
        bctx.fillRect(ix, iy, s, s);
      }
      bctx.restore();
    }
  }

  // Main render entry point
  function render(mainCanvas, models, state, t) {
    setCamera(state.camAngle);

    // 1. Warm cream-apricot studio backdrop (matching ref_front_iso.jpg)
    const grad = bctx.createRadialGradient(originX, originY - 10, 12, originX, originY, Math.max(viewW, viewH) * 0.72);
    grad.addColorStop(0, P.bgCenter);
    grad.addColorStop(1, P.bgEdge);
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, viewW, viewH);

    // Soft grounded shadow under the walnut turntable base
    drawShadow(0, 0, -2, 56, 56, 0.16);

    // 2. Rounded-square walnut turntable base + checkered kitchen floor + honey-oak dining floor
    drawModel(models.base, 0, 0, 0);

    const FLOOR_Z = 7;

    // 3. Build disjoint floor clusters and sort with exact 360° topological painter's sort!
    const clusters = [];

    // Cluster A: Kitchen Counter + all countertop items (cutting board, veggies, knife, rice cooker, roux tray & cubes, pickle jar)
    clusters.push({
      id: 'counter',
      x0: -45, x1: -21, y0: -23, y1: 27,
      depth: depthOf(-33, 2),
      draw() {
        drawModel(models.counter, -33, 2, FLOOR_Z);
        const TOP_Z = FLOOR_Z + 17;

        // Cutting board sits flat on front half of counter (wx=-33, wy=13)
        drawModel(models.board, -33, 13, TOP_Z, { outline: true });

        // Collect all countertop props sorted by rotated camera depth so they never clip each other!
        const items = [];

        // Rice cooker (back of counter: wx=-35, wy=-9)
        items.push({
          depth: depthOf(-35, -9),
          draw() {
            const cBounce = state.cookerBounce > 0 ? Math.sin(state.cookerBounce * Math.PI) * 1.4 : 0;
            drawModel(models.cookerBody, -35, -9, TOP_Z + cBounce);
            // Lid opens upward & tilted back (-wx) when cookerOpen > 0!
            const open = state.cookerOpen;
            if (open < 0.05) {
              drawModel(models.cookerLid, -35, -9, TOP_Z + 8 + cBounce);
            } else {
              // Popped-open lid perched behind the hinge (-wx = -41, lifted +13)!
              drawModel(models.cookerLid, -35 - open * 6.5, -9, TOP_Z + 8 + open * 6.5 + cBounce, {
                scaleX: 1 - open * 0.25,
                scaleZ: 1 + open * 0.6,
              });
            }
          },
        });

        // Silver Curry Roux Tray + remaining roux cubes (wx=-27, wy=-16)
        items.push({
          depth: depthOf(-27, -16),
          draw() {
            drawModel(models.rouxTray, -27, -16, TOP_Z);
            // Draw individual roux cubes sitting on tray (sorted by depth!)
            const onTray = state.rouxCubes
              .filter((r) => r.state === 'bar' || r.state === 'broken')
              .sort((a, b) => depthOf(a.wx, a.wy) - depthOf(b.wx, b.wy));
            for (const rc of onTray) {
              const hop = rc.hop > 0 ? Math.sin(rc.hop * Math.PI) * 3.5 : 0;
              // Gentle invitation shimmer once veggies are simmering & roux not yet added
              const nudge = (state.hintTarget === 'roux' && rc.state === 'bar')
                ? Math.max(0, Math.sin(t * 5 + rc.id) * 1.1) : 0;
              drawModel(models.rouxCube, rc.wx, rc.wy, TOP_Z + 2 + hop + nudge, {
                rot: rc.rot || 0,
              });
            }
          },
        });

        // Cute Red Fukujinzuke Pickle Jar tucked cleanly at far front-left corner of counter (wx=-40.5, wy=23.5)
        items.push({
          depth: depthOf(-40.5, 23.5),
          draw() {
            const jiggle = state.jarBounce > 0 ? Math.sin(state.jarBounce * Math.PI * 2) * 1.5 : 0;
            drawModel(models.pickleJar, -40.5, 23.5, TOP_Z + Math.abs(jiggle));
          },
        });

        // Veggies on the cutting board (whole or chopped piles)
        for (const veg of state.veggies) {
          if (veg.state !== 'whole' && veg.state !== 'chopped') continue;
          items.push({
            depth: depthOf(veg.wx, veg.wy) + 1,
            draw() {
              const m = veg.state === 'whole'
                ? models['veggie_' + veg.type + '_whole']
                : models['veggie_' + veg.type + '_chopped'];
              const squash = veg.chopAnim > 0 ? 1 - Math.sin(veg.chopAnim * Math.PI) * 0.25 : 1;
              const hop = veg.hop > 0 ? Math.sin(veg.hop * Math.PI) * 3.5 : 0;
              const nudge = (state.hintTarget === 'veggie' && veg.state === 'whole')
                ? Math.max(0, Math.sin(t * 5 + veg.id * 1.3) * 1.1) : 0;
              const nudgeChop = (state.hintTarget === 'chopped' && veg.state === 'chopped')
                ? Math.max(0, Math.sin(t * 6 + veg.id) * 1.3) : 0;
              drawModel(m, veg.wx, veg.wy, TOP_Z + 2.5 + hop + nudge + nudgeChop, {
                scaleZ: squash,
                scaleX: 2 - squash,
                rot: veg.rot || 0,
              });
            },
          });
        }

        // Kitchen Knife on the front edge of the cutting board (or leaping to chop!)
        items.push({
          depth: depthOf(state.knife.wx, state.knife.wy) + 2,
          draw() {
            const k = state.knife;
            const chopZ = k.anim > 0 ? Math.sin(k.anim * Math.PI) * 7.5 : 0;
            const nudge = state.hintTarget === 'veggie' ? Math.max(0, Math.sin(t * 5.2) * 1.2) : 0;
            drawModel(models.knife, k.wx, k.wy, TOP_Z + 2.5 + chopZ + nudge, {
              rot: k.rot + (k.anim > 0 ? Math.sin(k.anim * Math.PI) * 0.35 : 0),
            });
          },
        });

        items.sort((a, b) => a.depth - b.depth);
        for (const it of items) it.draw();
      },
    });

    // Cluster B: Gas Stove + Blue Flames + Cherry-Red Enamel Curry Pot!
    clusters.push({
      id: 'stove',
      x0: -7, x1: 17, y0: 12, y1: 36,
      depth: depthOf(5, 24),
      draw() {
        const stoveModel = models['stove_' + state.stoveHeat];
        drawModel(stoveModel, 5, 24, FLOOR_Z);
        drawFlames(5, 24, FLOOR_Z + 16, state.stoveHeat, t);
        const potShake = state.stoveHeat === 2 ? Math.sin(t * 24) * 0.25 : 0;
        drawCurryPot(models, state, 5 + potShake, 24, FLOOR_Z + 17, t);
      },
    });

    // Cluster C: Dining Table + 3 Woven Placemats + 3 Spoons + Serving Rice Plate + Delivered Plates!
    clusters.push({
      id: 'table',
      x0: -12, x1: 38, y0: -23, y1: 1,
      depth: depthOf(13, -11),
      draw() {
        drawModel(models.table, 13, -11, FLOOR_Z);
        const TABLE_Z = FLOOR_Z + 14;

        // 3 woven placemats & spoons in front of Mama, Papa, Little Girl
        for (const seat of state.seats) {
          const pulse = (state.hintTarget === 'deliver' && !seat.plate)
            ? 1 + Math.sin(t * 6 + seat.id) * 0.04 : 1;
          drawModel(models.placemat, seat.matX, seat.matY, TABLE_Z, {
            outline: true,
            scaleX: pulse,
            scaleY: pulse,
          });
          // Silver spoon beside each placemat (on left side -x)
          drawModel(models.spoon, seat.matX - 6.8, seat.matY + 0.5, TABLE_Z + 0.8, {
            outline: true,
            rot: seat.spoonTap > 0 ? Math.sin(seat.spoonTap * Math.PI * 3) * 0.35 : 0,
          });
        }

        // Plates resting on table (serving plate + delivered plates), sorted by depth!
        const tablePlates = [];
        for (const pl of state.plates) {
          if (pl.state === 'serving' || pl.state === 'seated') {
            tablePlates.push(pl);
          }
        }
        tablePlates.sort((a, b) => depthOf(a.wx, a.wy) - depthOf(b.wx, b.wy));
        for (const pl of tablePlates) {
          const hop = pl.hop > 0 ? Math.sin(pl.hop * Math.PI) * 3.5 : 0;
          const nudge = (state.hintTarget === 'ladle' && pl.state === 'serving' && pl.curryScoops === 0)
            ? Math.max(0, Math.sin(t * 5.5) * 1.1)
            : (state.hintTarget === 'deliver' && pl.state === 'serving' && pl.curryScoops > 0)
              ? Math.max(0, Math.sin(t * 6) * 1.3) : 0;
          drawModel(pl.model, pl.wx, pl.wy, TABLE_Z + 1 + hop + nudge);
        }
      },
    });

    // Clusters D/E/F: 3 Family Seats (ChairSeat + Seated Person + ChairBack, separated cleanly for 360° seating!)
    for (const seat of state.seats) {
      // Person + chair seat cluster (y ∈ [-36, -24])
      clusters.push({
        id: 'person_' + seat.who,
        x0: seat.wx - 7, x1: seat.wx + 7, y0: -36, y1: -24,
        depth: depthOf(seat.wx, -30),
        draw() {
          drawModel(models.chairSeat, seat.wx, -32, FLOOR_Z);
          const isHappy = seat.mood === 'happy' || seat.mood === 'eating' || state.celebrating;
          const pModel = models[seat.who + (isHappy ? 'Happy' : '')];
          let bounce = 0;
          if (state.celebrating) {
            bounce = Math.abs(Math.sin(t * 7 + seat.id * 1.4)) * 3.2;
          } else if (seat.mood === 'eating') {
            bounce = Math.abs(Math.sin(t * 8 + seat.id)) * 1.6;
          } else if (seat.bounce > 0) {
            bounce = Math.sin(seat.bounce * Math.PI) * 3.0;
          } else if (state.pot.rouxMelted >= 2 && !seat.plate) {
            // Excitedly bobbing from delicious curry aroma!
            bounce = Math.max(0, Math.sin(t * 4.5 + seat.id * 1.1)) * 0.9;
          }
          drawModel(pModel, seat.wx, -30.5, FLOOR_Z + 1 + bounce);
        },
      });
      // Chair backrest cluster (y ∈ [-40, -37], strictly behind person along -y!)
      clusters.push({
        id: 'chairBack_' + seat.who,
        x0: seat.wx - 6, x1: seat.wx + 6, y0: -40, y1: -37,
        depth: depthOf(seat.wx, -38.5),
        draw() {
          drawModel(models.chairBack, seat.wx, -38, FLOOR_Z);
        },
      });
    }

    // Sort all clusters with exact 360° topological painter's sort and render!
    const ordered = sortClusters(clusters);
    for (const c of ordered) c.draw();

    // 4. Flying / Arcing items & Currently Dragged items (always rendered cleanly above surfaces with grounded shadow!)
    for (const veg of state.veggies) {
      if (veg.state === 'dragging' || veg.state === 'flying') {
        drawShadow(veg.wx, veg.wy, FLOOR_Z + 17, 5, 5, 0.25);
        const m = veg.state === 'flying' || veg.chopped
          ? models['veggie_' + veg.type + (veg.chopped ? '_chopped' : '_whole')]
          : models['veggie_' + veg.type + '_whole'];
        drawModel(m, veg.wx, veg.wy, veg.wz);
      }
    }

    for (const rc of state.rouxCubes) {
      if (rc.state === 'dragging' || rc.state === 'flying') {
        drawShadow(rc.wx, rc.wy, FLOOR_Z + 17, 3.8, 3.8, 0.25);
        drawModel(models.rouxCube, rc.wx, rc.wy, rc.wz, { rot: rc.rot || 0 });
      }
    }

    for (const pl of state.plates) {
      if (pl.state === 'dragging' || pl.state === 'flying') {
        drawShadow(pl.wx, pl.wy, FLOOR_Z + 14, 7.2, 5.6, 0.24);
        drawModel(pl.model, pl.wx, pl.wy, pl.wz);
      }
    }

    // Lifted wooden ladle carrying rich curry to a rice plate!
    if (state.ladleLifted) {
      const l = state.ladleFly;
      drawShadow(l.wx, l.wy, FLOOR_Z + 16, 4.5, 4.5, 0.2);
      drawModel(models.ladle, l.wx, l.wy, l.wz, { rot: l.rot });
      // Glossy dollop of curry sitting right in the ladle bowl!
      if (l.hasCurry) {
        const cols = CU.curryColors(state.pot.rouxMelted, state.pot.veggieStock);
        const p = project(l.wx, l.wy, l.wz + 2);
        bctx.fillStyle = P.outline;
        bctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 4);
        bctx.fillStyle = cols.main;
        bctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 2);
        bctx.fillStyle = cols.hi;
        bctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 1, 1);
      }
    }

    // 5. Steam clouds, aroma sparkles, splashes, hearts & celebratory stars!
    drawParticles(state.particles);

    // 6. Blit crisp nearest-neighbor pixel buffer to full-screen main canvas!
    const mctx = mainCanvas.getContext('2d');
    mctx.imageSmoothingEnabled = false;
    mctx.fillStyle = P.bgEdge;
    mctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

    const dpr = mainCanvas.width / Math.max(1, window.innerWidth);
    mctx.drawImage(
      buf,
      0, 0, viewW, viewH,
      Math.round(screenOffX * dpr),
      Math.round(screenOffY * dpr),
      Math.round(viewW * screenScale * dpr),
      Math.round(viewH * screenScale * dpr)
    );
  }

  return {
    resize,
    render,
    project,
    screenToWorld,
    worldToScreenCss,
    getMetrics: () => ({ viewW, viewH, screenScale, screenOffX, screenOffY }),
  };
})();
