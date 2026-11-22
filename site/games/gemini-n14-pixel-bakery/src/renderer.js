// Crisp Sprite-Stacking Pseudo-3D Renderer for Pixel Bakery
// Interleaves dynamic objects (dough, rising breads, toppings, flames, customers,
// coins, shop decorations) slice-by-slice with the 68-layer shop diorama so
// 360-degree rotation has rock-solid occlusion and authentic pixel-art outlines.

(function () {
  const OUTLINE_U32 = new Uint32Array(new Uint8Array([0x2e, 0x1b, 0x14, 0xff]).buffer)[0];

  class BakeryRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.tilt = 0.52;
      this.zStep = 1.0;

      // Virtual pixel-art buffer for crisp sprite stacking + 1px outline pass
      this.vCanvas = document.createElement("canvas");
      this.vCtx = this.vCanvas.getContext("2d", { willReadFrequently: true });
      this.vw = 240;
      this.vh = 180;
      this.cx = 120;
      this.cy = 108;
      this.displayScale = 3;
      this.dpr = 1;

      this.ready = false;
      this.shopImg = null;
      this.propsImg = null;
      this.meta = window.BAKERY_SPRITES;

      // Pre-rendered icon thumbnails for the bottom wordless wooden shape tray
      this.shapeIcons = {};
      this._outlineScratch = null;
    }

    load(onReady) {
      let loaded = 0;
      const done = () => {
        loaded++;
        if (loaded === 2) {
          this._buildShapeIcons();
          this.ready = true;
          if (onReady) onReady();
        }
      };

      this.shopImg = new Image();
      this.shopImg.onload = done;
      this.shopImg.src = this.meta.shop.dataUrl;

      this.propsImg = new Image();
      this.propsImg.onload = done;
      this.propsImg.src = this.meta.props.dataUrl;
    }

    _buildShapeIcons() {
      // Pre-render each bread shape as a crisp mini sprite-stack icon for the wooden tray
      const shapes = ["melon", "croissant", "heart", "cinnamon", "baguette"];
      for (const sh of shapes) {
        const key = `${sh}_baked`;
        const info = this.meta.props.items[key];
        if (!info) continue;
        const ic = document.createElement("canvas");
        ic.width = 28;
        ic.height = 24;
        const ictx = ic.getContext("2d", { willReadFrequently: true });
        ictx.imageSmoothingEnabled = false;
        const ang = 0.52;
        for (let z = 0; z < info.h; z++) {
          ictx.save();
          ictx.translate(14, 16 - z);
          ictx.scale(1, 0.56);
          ictx.rotate(ang);
          ictx.drawImage(
            this.propsImg,
            z * info.w, info.y, info.w, info.d,
            -info.w * 0.5, -info.d * 0.5, info.w, info.d
          );
          ictx.restore();
        }
        this._applyOutline(ictx, 28, 24);
        this.shapeIcons[sh] = ic;
      }
    }

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";

      // Fit the 128x128x68 bakery comfortably on both portrait iPhone and landscape iPad/Desktop
      const aspect = w / Math.max(1, h);
      if (aspect >= 1.0) {
        // Landscape (iPad / desktop / 4:3)
        this.vh = 192;
        this.vw = Math.max(210, Math.round(this.vh * aspect));
        this.cx = Math.round(this.vw * 0.5);
        this.cy = Math.round(this.vh * 0.59);
      } else {
        // Portrait (iPhone) — generous diorama size with cozy breathing room above tray
        this.vw = 154;
        this.vh = Math.max(216, Math.round(this.vw / aspect));
        this.cx = Math.round(this.vw * 0.5);
        this.cy = Math.round(this.vh * 0.51);
      }

      if (this.vCanvas.width !== this.vw || this.vCanvas.height !== this.vh) {
        this.vCanvas.width = this.vw;
        this.vCanvas.height = this.vh;
        this._outlineScratch = new Uint32Array(this.vw * this.vh);
      }
      this.displayScaleX = w / this.vw;
      this.displayScaleY = h / this.vh;
    }

    // Project 3D bakery world coordinates -> CSS screen coordinates
    worldToScreen(wx, wy, wz, angle) {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const vx = this.cx + (wx * ca - wy * sa);
      const vy = this.cy + (wx * sa + wy * ca) * this.tilt - wz * this.zStep;
      return {
        x: vx * this.displayScaleX,
        y: vy * this.displayScaleY,
        vx,
        vy,
      };
    }

    // Convert CSS screen point -> world (wx, wy) on horizontal plane z = targetZ
    screenToWorldPlane(sx, sy, targetZ, angle) {
      const vx = sx / this.displayScaleX;
      const vy = sy / this.displayScaleY;
      const rx = vx - this.cx;
      const ry = (vy + targetZ * this.zStep - this.cy) / this.tilt;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      return {
        x: rx * ca + ry * sa,
        y: -rx * sa + ry * ca,
      };
    }

    // Determine whether an entity at (x, y) is occluded behind the L-shaped bakery walls
    // when the player rotates the shop around to inspect the back.
    _isBehindWall(obj, angle) {
      const sa = Math.sin(angle);
      const ca = Math.cos(angle);
      if (obj.layer === "outside") {
        // Exterior customers / rear decorations: behind shop center when camDepth < -10
        const camDepth = obj.x * sa + obj.y * ca;
        return camDepth < -10;
      }
      if (obj.layer === "drag") {
        // Currently dragged item floats cleanly on top
        return false;
      }
      // Interior objects (inside x > -34, y > -34):
      // Left wall is at x = -36 (occludes when viewing from -x side -> sa < -0.18)
      // Right wall is at y = -36 (occludes when viewing from -y side -> ca < -0.18)
      if (obj.layer === "oven") {
        // Oven mouth opens toward +x; occluded when viewed from back-left or far-back
        return sa < -0.12 || ca < -0.35;
      }
      return sa < -0.22 || ca < -0.22;
    }

    _drawPropSlice(ctx, obj, sliceIdx, worldZ, angle, ca, sa) {
      const info = this.meta.props.items[obj.key];
      if (!info) return;
      const zIdx = Math.max(0, Math.min(info.h - 1, sliceIdx));
      const rx = obj.x * ca - obj.y * sa;
      const ry = (obj.x * sa + obj.y * ca) * this.tilt;
      const px = this.cx + rx;
      const py = this.cy + ry - worldZ * this.zStep;

      const sx = obj.scaleX || 1;
      const sy = obj.scaleY || 1;
      const rot = angle + (obj.rot || 0);

      ctx.save();
      ctx.translate(Math.round(px), Math.round(py));
      ctx.scale(1, this.tilt);
      ctx.rotate(rot);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.drawImage(
        this.propsImg,
        zIdx * info.w, info.y, info.w, info.d,
        -info.w * 0.5, -info.d * 0.5, info.w, info.d
      );
      // Optional baking crossfade overlay (raw -> baked or baked -> burnt!)
      if (obj.blendKey && obj.blendAlpha > 0.02) {
        const bInfo = this.meta.props.items[obj.blendKey];
        if (bInfo) {
          const bz = Math.max(0, Math.min(bInfo.h - 1, sliceIdx));
          ctx.globalAlpha = Math.min(1, obj.blendAlpha);
          ctx.drawImage(
            this.propsImg,
            bz * bInfo.w, bInfo.y, bInfo.w, bInfo.d,
            -bInfo.w * 0.5, -bInfo.d * 0.5, bInfo.w, bInfo.d
          );
        }
      }
      ctx.restore();
    }

    _applyOutline(ctx, w, h) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const u32 = new Uint32Array(imgData.data.buffer);
      let scratch = this._outlineScratch;
      if (!scratch || scratch.length !== w * h) {
        scratch = new Uint32Array(w * h);
      }
      scratch.set(u32);

      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
          const idx = row + x;
          if ((scratch[idx] >>> 24) === 0) {
            if (
              (scratch[idx - 1] >>> 24) > 128 ||
              (scratch[idx + 1] >>> 24) > 128 ||
              (scratch[idx - w] >>> 24) > 128 ||
              (scratch[idx + w] >>> 24) > 128
            ) {
              u32[idx] = OUTLINE_U32;
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    render(state) {
      if (!this.ready) return;

      const ctx = this.ctx;
      const vCtx = this.vCtx;
      const w = this.canvas.width / this.dpr;
      const h = this.canvas.height / this.dpr;
      const angle = state.angle;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      // -------------------------------------------------------------
      // 1. Render all sprite-stacked layers into virtual pixel buffer
      // -------------------------------------------------------------
      vCtx.clearRect(0, 0, this.vw, this.vh);
      vCtx.imageSmoothingEnabled = false;

      const shopMeta = this.meta.shop;
      const sw = shopMeta.w;
      const sd = shopMeta.d;
      const sh = shopMeta.h;
      const scols = shopMeta.cols;

      // Sort dynamic objects by camera depth (far -> near)
      const dynObjs = state.renderObjects;
      for (let i = 0; i < dynObjs.length; i++) {
        const o = dynObjs[i];
        o._depth = o.x * sa + o.y * ca;
        o._behind = this._isBehindWall(o, angle);
        const info = this.meta.props.items[o.key];
        o._h = info ? info.h : 0;
        o._zMin = Math.floor(o.z);
        o._zMax = Math.ceil(o.z + o._h * (o.scaleZ || 1));
      }
      dynObjs.sort((a, b) => a._depth - b._depth);

      // Separate floating dragged item (drawn cleanly above everything so it never clips)
      const worldObjs = [];
      const dragObjs = [];
      for (let i = 0; i < dynObjs.length; i++) {
        if (dynObjs[i].layer === "drag") dragObjs.push(dynObjs[i]);
        else worldObjs.push(dynObjs[i]);
      }

      // Slice-by-slice interleaved rendering from z = 0 to sh - 1 (68 slices!)
      for (let z = 0; z < sh; z++) {
        // (a) Objects behind the walls at height z
        for (let i = 0; i < worldObjs.length; i++) {
          const o = worldObjs[i];
          if (!o._behind || z < o._zMin || z >= o._zMax) continue;
          const localSlice = Math.floor((z - o.z) / (o.scaleZ || 1));
          if (localSlice >= 0 && localSlice < o._h) {
            this._drawPropSlice(vCtx, o, localSlice, z, angle, ca, sa);
          }
        }

        // (b) Shop diorama horizontal slice z
        const col = z % scols;
        const row = (z / scols) | 0;
        vCtx.save();
        vCtx.translate(this.cx, Math.round(this.cy - z * this.zStep));
        vCtx.scale(1, this.tilt);
        vCtx.rotate(angle);
        vCtx.drawImage(
          this.shopImg,
          col * sw, row * sd, sw, sd,
          -sw * 0.5, -sd * 0.5, sw, sd
        );
        vCtx.restore();

        // (c) Objects in front of the walls at height z
        for (let i = 0; i < worldObjs.length; i++) {
          const o = worldObjs[i];
          if (o._behind || z < o._zMin || z >= o._zMax) continue;
          const localSlice = Math.floor((z - o.z) / (o.scaleZ || 1));
          if (localSlice >= 0 && localSlice < o._h) {
            this._drawPropSlice(vCtx, o, localSlice, z, angle, ca, sa);
          }
        }
      }

      // Draw dragged bread cleanly on top (1px per vertical step using scaleZ!)
      for (let i = 0; i < dragObjs.length; i++) {
        const o = dragObjs[i];
        const sz = o.scaleZ || 1;
        const steps = Math.max(1, Math.round(o._h * sz));
        for (let step = 0; step < steps; step++) {
          const localSlice = Math.min(o._h - 1, Math.floor(step / sz));
          this._drawPropSlice(vCtx, o, localSlice, o.z + step, angle, ca, sa);
        }
      }

      // Apply authentic 1px warm-brown pixel-art silhouette outline!
      this._applyOutline(vCtx, this.vw, this.vh);

      // -------------------------------------------------------------
      // 2. Composite onto full-resolution display canvas
      // -------------------------------------------------------------
      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      // Warm sunlit cream backdrop gradient
      const bgGrad = ctx.createRadialGradient(
        w * 0.5, h * 0.46, Math.min(w, h) * 0.1,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.78
      );
      bgGrad.addColorStop(0, "#FFF8E8");
      bgGrad.addColorStop(0.65, "#F9ECD0");
      bgGrad.addColorStop(1, "#F0DDB8");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft warm turntable floor shadow beneath the circular base
      const basePos = this.worldToScreen(0, 0, 0, angle);
      const radX = 63 * this.displayScaleX;
      const radY = 63 * this.tilt * this.displayScaleY;
      ctx.save();
      ctx.fillStyle = "rgba(130, 74, 34, 0.16)";
      ctx.beginPath();
      ctx.ellipse(
        basePos.x + 6,
        basePos.y + 6,
        radX * 1.03,
        radY * 1.04,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      // Subtle curved turntable rotation hint dots around outer wood base when idle
      if (state.idleTurntablePulse > 0.01) {
        ctx.save();
        ctx.strokeStyle = `rgba(184, 110, 48, ${0.22 * state.idleTurntablePulse})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y + 2, radX * 1.08, radY * 1.08, 0, 0.15, Math.PI - 0.15);
        ctx.stroke();
        ctx.restore();
      }

      // Blit the crisp pixel-art diorama!
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.vCanvas, 0, 0, this.vw, this.vh, 0, 0, w, h);

      // -------------------------------------------------------------
      // 3. Festive bunting garland along wall top (unlocked at shopLevel >= 4!)
      // -------------------------------------------------------------
      if (state.shopLevel >= 4) {
        this._drawGarland(ctx, angle, state.time);
      }

      // -------------------------------------------------------------
      // 4. Warm oven fire glow & baking aura
      // -------------------------------------------------------------
      const ovenFront = this.worldToScreen(-20, -4, 27, angle);
      const ovenVisible = Math.sin(angle) > -0.15 && Math.cos(angle) > -0.35;
      if (ovenVisible) {
        const pulse = 0.85 + 0.15 * Math.sin(state.time * 9.5);
        const boost = state.ovenActive ? 1.55 : (state.ovenHover ? 1.35 : 0.9);
        const r = 24 * this.displayScaleX * boost * pulse;
        const g = ctx.createRadialGradient(ovenFront.x, ovenFront.y, 1, ovenFront.x, ovenFront.y, r);
        g.addColorStop(0, `rgba(255, 195, 70, ${state.ovenActive ? 0.42 : 0.22})`);
        g.addColorStop(0.55, `rgba(255, 110, 30, ${state.ovenActive ? 0.20 : 0.09})`);
        g.addColorStop(1, "rgba(255, 110, 30, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ovenFront.x, ovenFront.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // -------------------------------------------------------------
      // 5. Crisp Pixel Particles (steam, flour, hearts, sparkles, petals)
      // -------------------------------------------------------------
      this._drawParticles(ctx, state.particles, angle);

      // -------------------------------------------------------------
      // 6. Customer Wordless Thought Bubbles (cute mini bread/heart bubbles!)
      // -------------------------------------------------------------
      this._drawCustomerBubbles(ctx, state.customers, angle, state.time);

      // -------------------------------------------------------------
      // 7. Gentle Wordless Bottom Wooden Shape Tray (appears when dough is on table!)
      // -------------------------------------------------------------
      if (state.shapeTrayAlpha > 0.02) {
        this._drawShapeTray(ctx, state, w, h);
      }

      ctx.restore();
    }

    _drawGarland(ctx, angle, time) {
      const p1 = this.worldToScreen(-36, 6, 53, angle);
      const p2 = this.worldToScreen(-36, -36, 54, angle);
      const p3 = this.worldToScreen(34, -36, 54, angle);
      const colors = ["#F0464E", "#FFE042", "#69C795", "#5EABF7", "#FF85B0"];

      const drawSeg = (a, b, flags) => {
        ctx.strokeStyle = "#6E3D1C";
        ctx.lineWidth = Math.max(1.5, this.displayScaleX * 0.6);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 1; i <= flags; i++) {
          const t = i / flags;
          const sag = Math.sin(t * Math.PI) * 5 * this.displayScaleY;
          ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + sag);
        }
        ctx.stroke();

        for (let i = 0; i < flags; i++) {
          const t0 = (i + 0.15) / flags;
          const t1 = (i + 0.85) / flags;
          const tm = (i + 0.5) / flags;
          const sag0 = Math.sin(t0 * Math.PI) * 5 * this.displayScaleY;
          const sag1 = Math.sin(t1 * Math.PI) * 5 * this.displayScaleY;
          const sagm = Math.sin(tm * Math.PI) * 5 * this.displayScaleY;
          const sway = Math.sin(time * 3.5 + i * 1.1) * 1.5 * this.displayScaleX;
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0 + sag0);
          ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1 + sag1);
          ctx.lineTo(
            a.x + (b.x - a.x) * tm + sway,
            a.y + (b.y - a.y) * tm + sagm + 6.5 * this.displayScaleY
          );
          ctx.closePath();
          ctx.fill();
        }
      };
      drawSeg(p1, p2, 5);
      drawSeg(p2, p3, 8);
    }

    _drawParticles(ctx, particles, angle) {
      const pxScale = Math.max(2, Math.round(this.displayScaleX));
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const sc = this.worldToScreen(p.x, p.y, p.z, angle);
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.save();
        ctx.globalAlpha = alpha * (p.alpha || 1);
        const sz = Math.max(2, Math.round(p.size * this.displayScaleX));

        if (p.kind === "heart") {
          this._drawPixelHeart(ctx, sc.x, sc.y, Math.max(1.5, pxScale * 0.55), p.color || "#F0464E");
        } else if (p.kind === "star") {
          this._drawPixelStar(ctx, sc.x, sc.y, Math.max(1.5, pxScale * 0.55), p.color || "#FFE245");
        } else if (p.kind === "steam" || p.kind === "smoke") {
          ctx.fillStyle = p.color;
          const r = sz;
          ctx.fillRect(Math.round(sc.x - r * 0.5), Math.round(sc.y - r * 0.5), r, r);
          ctx.fillRect(Math.round(sc.x - r * 0.7), Math.round(sc.y - r * 0.25), Math.round(r * 1.4), Math.round(r * 0.5));
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(sc.x - sz * 0.5), Math.round(sc.y - sz * 0.5), sz, sz);
        }
        ctx.restore();
      }
    }

    _drawPixelHeart(ctx, cx, cy, u, color) {
      const pts = [
        [-2, -1], [-1, -2], [1, -2], [2, -1],
        [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1],
        [0, 2],
      ];
      ctx.fillStyle = "#2E1B14";
      for (const [dx, dy] of pts) {
        ctx.fillRect(Math.round(cx + dx * u - u * 0.2), Math.round(cy + dy * u - u * 0.2), Math.ceil(u * 1.4), Math.ceil(u * 1.4));
      }
      ctx.fillStyle = color;
      for (const [dx, dy] of pts) {
        ctx.fillRect(Math.round(cx + dx * u), Math.round(cy + dy * u), Math.ceil(u), Math.ceil(u));
      }
    }

    _drawPixelStar(ctx, cx, cy, u, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(cx - u * 0.5), Math.round(cy - u * 2.0), Math.ceil(u), Math.ceil(u * 4.0));
      ctx.fillRect(Math.round(cx - u * 2.0), Math.round(cy - u * 0.5), Math.ceil(u * 4.0), Math.ceil(u));
      ctx.fillStyle = "#FFFDF7";
      ctx.fillRect(Math.round(cx - u * 0.5), Math.round(cy - u * 0.5), Math.ceil(u), Math.ceil(u));
    }

    _drawCustomerBubbles(ctx, customers, angle, time) {
      const u = Math.max(2, this.displayScaleX * 0.85);
      for (let i = 0; i < customers.length; i++) {
        const c = customers[i];
        if (c.state !== "browse" && c.state !== "happy") continue;
        const bob = Math.sin(time * 4.5 + i * 2) * 2.5;
        const pos = this.worldToScreen(c.x, c.y, 29 + bob * 0.4, angle);
        const bw = Math.round(24 * u * 0.85);
        const bh = Math.round(20 * u * 0.85);
        const bx = Math.round(pos.x - bw * 0.5);
        const by = Math.round(pos.y - bh - 4);

        // Crisp pixel-art rounded bubble (no text!)
        ctx.save();
        ctx.fillStyle = "#2E1B14";
        ctx.fillRect(bx - 2, by, bw + 4, bh);
        ctx.fillRect(bx, by - 2, bw, bh + 4);
        ctx.fillStyle = "#FFFDF6";
        ctx.fillRect(bx, by, bw, bh);
        // Little pointer tail
        ctx.fillStyle = "#2E1B14";
        ctx.fillRect(Math.round(pos.x - 3), by + bh + 2, 6, 4);
        ctx.fillStyle = "#FFFDF6";
        ctx.fillRect(Math.round(pos.x - 2), by + bh, 4, 4);

        if (c.state === "happy") {
          this._drawPixelHeart(ctx, pos.x, by + bh * 0.5, Math.max(2, u * 0.85), "#F0464E");
        } else {
          // Show tiny bread icon inside thought bubble!
          const icon = this.shapeIcons[c.wantShape] || this.shapeIcons.melon;
          if (icon) {
            ctx.imageSmoothingEnabled = false;
            const iw = Math.round(bw * 0.84);
            const ih = Math.round(iw * (24 / 28));
            ctx.drawImage(icon, Math.round(pos.x - iw * 0.5), Math.round(by + (bh - ih) * 0.5), iw, ih);
          }
        }
        ctx.restore();
      }
    }

    getShapeTrayRects(w, h) {
      const shapes = ["melon", "croissant", "heart", "cinnamon", "baguette"];
      const btnSize = Math.min(62, Math.max(44, Math.floor((w - 58) / 5.7)));
      const gap = Math.min(12, Math.max(6, Math.floor(btnSize * 0.16)));
      const totalW = shapes.length * btnSize + (shapes.length - 1) * gap;
      const startX = Math.round((w - totalW) * 0.5);
      const y = h - btnSize - Math.max(22, Math.round(h * 0.036));
      return shapes.map((shape, idx) => ({
        shape,
        idx,
        x: startX + idx * (btnSize + gap),
        y,
        w: btnSize,
        h: btnSize,
      }));
    }

    _drawShapeTray(ctx, state, w, h) {
      const rects = this.getShapeTrayRects(w, h);
      const slide = (1 - state.shapeTrayAlpha) * 28;
      const pad = 8;
      const first = rects[0];
      const last = rects[rects.length - 1];
      const trayX = first.x - pad;
      const trayY = first.y - pad + slide;
      const trayW = last.x + last.w - first.x + pad * 2;
      const trayH = first.h + pad * 2;

      ctx.save();
      ctx.globalAlpha = state.shapeTrayAlpha;

      // Chunky wooden pixel tray backing (zero text, pure tactile craft look!)
      ctx.fillStyle = "#2E1B14";
      ctx.fillRect(trayX - 3, trayY - 3, trayW + 6, trayH + 6);
      ctx.fillStyle = "#B86B29";
      ctx.fillRect(trayX, trayY, trayW, trayH);
      ctx.fillStyle = "#DF9842";
      ctx.fillRect(trayX + 3, trayY + 3, trayW - 6, trayH - 8);
      ctx.fillStyle = "#F2B861";
      ctx.fillRect(trayX + 3, trayY + 3, trayW - 6, 4);

      for (const r of rects) {
        const selected = state.doughShape === r.shape;
        const bounce = selected ? -4 : (state.doughKneadReady ? Math.sin(state.time * 5 + r.idx * 0.9) * 2 : 0);
        const rx = r.x;
        const ry = r.y + slide + bounce;

        // Recessed wooden mold tile
        ctx.fillStyle = "#2E1B14";
        ctx.fillRect(rx - 2, ry - 2, r.w + 4, r.h + 4);
        ctx.fillStyle = selected ? "#FFF5D6" : "#F3DEC0";
        ctx.fillRect(rx, ry, r.w, r.h);
        ctx.fillStyle = selected ? "#FFE394" : "#E5C89E";
        ctx.fillRect(rx, ry + r.h - 5, r.w, 5);

        const icon = this.shapeIcons[r.shape];
        if (icon) {
          ctx.imageSmoothingEnabled = false;
          const iw = Math.round(r.w * 0.84);
          const ih = Math.round(iw * (24 / 28));
          ctx.drawImage(
            icon,
            Math.round(rx + (r.w - iw) * 0.5),
            Math.round(ry + (r.h - ih) * 0.5),
            iw, ih
          );
        }
      }
      ctx.restore();
    }
  }

  window.BakeryRenderer = BakeryRenderer;
})();
