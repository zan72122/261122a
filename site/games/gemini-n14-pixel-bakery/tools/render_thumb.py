#!/usr/bin/env python3
"""
Render a crisp 4:3 (1024x768) hero thumbnail directly from the exact same
sprite-stacking slices & projection math as src/renderer.js, then convert
to thumb.jpg via macOS sips.
"""

import os
import sys
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(BASE_DIR, "tools")
sys.path.insert(0, TOOLS_DIR)

import build_slices as bs

def main():
    print("Building voxel slices for hero 4:3 thumbnail...")
    shop = bs.build_bakery_shop()
    shop_slices = shop.bake_slices_rgba(ao_strength=0.15, top_boost=1.08)

    def bake_prop(mdl, rim):
        return {
            "slices": mdl.bake_slices_rgba(ao_strength=0.11, top_boost=1.09, rim_color=rim),
            "w": mdl.w, "d": mdl.d, "h": mdl.h,
        }

    rim_baked = bs.hx("#5C270A")
    rim_raw = bs.hx("#7A6752")
    rim_ol = bs.PAL["outline"]

    props = {
        "fire":           bake_prop(bs.build_fire_frame(1), None),
        "heart_raw":      bake_prop(bs.build_dough_or_bread("heart", "raw"), rim_raw),
        "melon_baked":    bake_prop(bs.build_dough_or_bread("melon", "baked"), rim_baked),
        "croissant_baked":bake_prop(bs.build_dough_or_bread("croissant", "baked"), rim_baked),
        "heart_baked":    bake_prop(bs.build_dough_or_bread("heart", "baked"), rim_baked),
        "cinnamon_baked": bake_prop(bs.build_dough_or_bread("cinnamon", "baked"), rim_baked),
        "baguette_baked": bake_prop(bs.build_dough_or_bread("baguette", "baked"), rim_baked),
        "jumbo_baked":    bake_prop(bs.build_dough_or_bread("jumbo", "baked"), rim_baked),
        "top_strawberry": bake_prop(bs.build_topping("strawberry"), rim_baked),
        "top_choco":      bake_prop(bs.build_topping("choco"), rim_baked),
        "top_butter":     bake_prop(bs.build_topping("butter"), rim_baked),
        "cust_girl":      bake_prop(bs.build_customer("girl", 0), rim_ol),
        "cust_grandma":   bake_prop(bs.build_customer("grandma", 1), rim_ol),
        "coin":           bake_prop(bs.build_coin_stack(), rim_ol),
        "deco_sign":      bake_prop(bs.build_deco_sign(), rim_ol),
        "deco_flowers":   bake_prop(bs.build_deco_flowers(), rim_ol),
        "deco_lantern":   bake_prop(bs.build_deco_lantern(), rim_ol),
    }

    # Exact virtual resolution matching renderer.js at 1024x768 (4:3, 4x integer pixel scale!)
    VW, VH = 256, 192
    CX, CY = 128, 113
    TILT = 0.52
    ANGLE = math.radians(45)
    CA, SA = math.cos(ANGLE), math.sin(ANGLE)

    # Dynamic scene objects (exact world coordinates from src/game.js)
    objs = [
        # Oven fire + freshly puffed golden croissant/melon at hearth lip
        {"key": "fire", "x": -28, "y": -4, "z": 21, "sx": 1.15, "sy": 1.15, "sz": 1.15, "rot": 0},
        {"key": "melon_baked", "x": -18, "y": -4, "z": 22, "sx": 1.05, "sy": 1.05, "sz": 1.05, "rot": 0},
        # Kneading board: heart dough + strawberry topping!
        {"key": "heart_raw", "x": 7, "y": 10, "z": 22, "sx": 0.96, "sy": 0.96, "sz": 0.96, "rot": 0},
        {"key": "top_strawberry", "x": 7, "y": 10, "z": 27.5, "sx": 0.95, "sy": 0.95, "sz": 0.95, "rot": 0},
        # 3-Tier Wooden Display Shelf packed with delicious varied breads!
        # Top tier (z = 38)
        {"key": "heart_baked", "x": -17, "y": -27, "z": 38, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "top_strawberry", "x": -17, "y": -27, "z": 43, "sx": 0.85, "sy": 0.85, "sz": 0.85, "rot": 0},
        {"key": "croissant_baked", "x": -8, "y": -27, "z": 38, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "top_butter", "x": -8, "y": -27, "z": 43, "sx": 0.85, "sy": 0.85, "sz": 0.85, "rot": 0},
        {"key": "cinnamon_baked", "x": 1, "y": -27, "z": 38, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "top_choco", "x": 1, "y": -27, "z": 43, "sx": 0.85, "sy": 0.85, "sz": 0.85, "rot": 0},
        # Middle tier (z = 28)
        {"key": "melon_baked", "x": -17, "y": -27, "z": 28, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "baguette_baked", "x": -8, "y": -27, "z": 28, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "heart_baked", "x": 1, "y": -27, "z": 28, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "top_strawberry", "x": 1, "y": -27, "z": 33, "sx": 0.85, "sy": 0.85, "sz": 0.85, "rot": 0},
        # Bottom tier (z = 18)
        {"key": "croissant_baked", "x": -16, "y": -27, "z": 18, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        {"key": "cinnamon_baked", "x": -6, "y": -27, "z": 18, "sx": 0.88, "sy": 0.88, "sz": 0.88, "rot": 0},
        # Stacked gleaming gold coins on register coin tray
        {"key": "coin", "x": 32, "y": -6, "z": 23, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "coin", "x": 32, "y": -6, "z": 25, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "coin", "x": 32, "y": -6, "z": 27, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "coin", "x": 29.5, "y": -4.5, "z": 23, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "coin", "x": 29.5, "y": -4.5, "z": 25, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "coin", "x": 34.4, "y": -4.7, "z": 23, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        # Unlocked shop decorations (sign, potted flowers, warm lantern!)
        {"key": "deco_sign", "x": 42, "y": -14, "z": 8, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "deco_flowers", "x": -24, "y": 31, "z": 8, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        {"key": "deco_lantern", "x": 39, "y": 12, "z": 8, "sx": 1, "sy": 1, "sz": 1, "rot": 0},
        # Two adorable customers browsing on the front cobblestone path!
        # Red-beret girl looking happily toward bakery (positioned slightly right so table & dishes stay 100% clear!)
        {"key": "cust_girl", "x": 36, "y": 31, "z": 9, "sx": 1, "sy": 1, "sz": 1,
         "rot": math.atan2(-20, -35) - math.pi * 0.5},
        # Grandma strolling happily holding a fresh croissant!
        {"key": "cust_grandma", "x": -10, "y": 47, "z": 9, "sx": 1, "sy": 1, "sz": 1,
         "rot": math.atan2(-25, 32) - math.pi * 0.5},
        {"key": "croissant_baked", "x": -6, "y": 44, "z": 19, "sx": 0.78, "sy": 0.78, "sz": 0.78, "rot": 0.3},
    ]

    for o in objs:
        o["depth"] = o["x"] * SA + o["y"] * CA
        o["h"] = props[o["key"]]["h"]
    objs.sort(key=lambda o: o["depth"])

    fg = bytearray(VW * VH * 4)

    def blit_slice(sbuf, w, d, cx, cy, angle_rad, sx=1.0, sy=1.0):
        ca = math.cos(angle_rad)
        sa = math.sin(angle_rad)
        hw = w * 0.5
        hd = d * 0.5
        rad = int(math.hypot(hw * sx, hd * sy)) + 2
        rad_y = int(rad * TILT) + 2
        y_min = max(0, int(cy - rad_y))
        y_max = min(VH - 1, int(cy + rad_y))
        x_min = max(0, int(cx - rad))
        x_max = min(VW - 1, int(cx + rad))
        inv_sx = 1.0 / sx
        inv_sy = 1.0 / sy
        for py in range(y_min, y_max + 1):
            dy = (py - cy) / TILT
            for px in range(x_min, x_max + 1):
                dx = px - cx
                ux = int(math.floor((dx * ca + dy * sa) * inv_sx + hw))
                uy = int(math.floor((-dx * sa + dy * ca) * inv_sy + hd))
                if 0 <= ux < w and 0 <= uy < d:
                    sp = (uy * w + ux) * 4
                    if sbuf[sp + 3] > 128:
                        dp = (py * VW + px) * 4
                        fg[dp] = sbuf[sp]
                        fg[dp + 1] = sbuf[sp + 1]
                        fg[dp + 2] = sbuf[sp + 2]
                        fg[dp + 3] = 255

    # Interleaved slice-by-slice render (z = 0..67)
    for z in range(shop.h):
        # Shop horizontal slice z
        blit_slice(shop_slices[z], shop.w, shop.d, CX, CY - z, ANGLE)
        # Dynamic objects at height z
        for o in objs:
            sz = o["sz"]
            z0 = int(math.floor(o["z"]))
            z1 = int(math.ceil(o["z"] + o["h"] * sz))
            if z < z0 or z >= z1:
                continue
            local_s = int(math.floor((z - o["z"]) / sz))
            if 0 <= local_s < o["h"]:
                pinfo = props[o["key"]]
                rx = o["x"] * CA - o["y"] * SA
                ry = (o["x"] * SA + o["y"] * CA) * TILT
                blit_slice(
                    pinfo["slices"][local_s], pinfo["w"], pinfo["d"],
                    CX + rx, CY + ry - z, ANGLE + o["rot"], o["sx"], o["sy"]
                )

    # Apply crisp 1px warm-brown silhouette outline on virtual buffer
    ol = bs.PAL["outline"]
    fg_ol = bytearray(fg)
    for y in range(1, VH - 1):
        for x in range(1, VW - 1):
            p = (y * VW + x) * 4
            if fg[p + 3] == 0:
                if (fg[p - 4 + 3] > 128 or fg[p + 4 + 3] > 128 or
                    fg[p - VW * 4 + 3] > 128 or fg[p + VW * 4 + 3] > 128):
                    fg_ol[p], fg_ol[p + 1], fg_ol[p + 2], fg_ol[p + 3] = ol[0], ol[1], ol[2], 255

    # Helper to project world -> 1024x768 output coordinates
    SCALE = 4
    OW, OH = VW * SCALE, VH * SCALE  # 1024 x 768 (exact 4:3!)

    def w2s(wx, wy, wz):
        vx = CX + (wx * CA - wy * SA)
        vy = CY + (wx * SA + wy * CA) * TILT - wz
        return vx * SCALE, vy * SCALE

    out = bytearray(OW * OH * 4)

    # 1. Warm sunlit cream radial backdrop + soft turntable drop shadow
    base_x, base_y = w2s(0, 0, 0)
    sh_rx = 65 * SCALE
    sh_ry = 65 * TILT * SCALE
    for y in range(OH):
        ny = (y / OH - 0.46) / 0.72
        for x in range(OW):
            nx = (x / OW - 0.5) / 0.72
            t = min(1.0, math.hypot(nx, ny))
            # #FFF8E8 -> #F9ECD0 -> #F0DDB8
            if t < 0.65:
                u = t / 0.65
                r = int(255 + (249 - 255) * u)
                g = int(248 + (236 - 248) * u)
                b = int(232 + (208 - 232) * u)
            else:
                u = (t - 0.65) / 0.35
                r = int(249 + (240 - 249) * u)
                g = int(236 + (221 - 236) * u)
                b = int(208 + (184 - 208) * u)
            # Elliptical turntable floor shadow
            sdx = (x - (base_x + 6)) / sh_rx
            sdy = (y - (base_y + 6)) / sh_ry
            if sdx * sdx + sdy * sdy <= 1.0:
                r = int(r * 0.84 + 130 * 0.16)
                g = int(g * 0.84 + 74 * 0.16)
                b = int(b * 0.84 + 34 * 0.16)
            dp = (y * OW + x) * 4
            out[dp], out[dp + 1], out[dp + 2], out[dp + 3] = r, g, b, 255

    # 2. Blit crisp 4x nearest-neighbor sprite-stacked bakery!
    for vy in range(VH):
        for vx in range(VW):
            sp = (vy * VW + vx) * 4
            if fg_ol[sp + 3] > 128:
                r, g, b = fg_ol[sp], fg_ol[sp + 1], fg_ol[sp + 2]
                for sy in range(SCALE):
                    row_off = ((vy * SCALE + sy) * OW + vx * SCALE) * 4
                    for sx in range(SCALE):
                        dp = row_off + sx * 4
                        out[dp], out[dp + 1], out[dp + 2], out[dp + 3] = r, g, b, 255

    # Helpers for crisp overlays on 1024x768
    def fill_rect(x0, y0, w, h, rgb, alpha=1.0):
        x0, y0, w, h = int(round(x0)), int(round(y0)), int(round(w)), int(round(h))
        r, g, b = rgb
        for y in range(max(0, y0), min(OH, y0 + h)):
            row = y * OW * 4
            for x in range(max(0, x0), min(OW, x0 + w)):
                dp = row + x * 4
                if alpha >= 0.99:
                    out[dp], out[dp + 1], out[dp + 2] = r, g, b
                else:
                    out[dp] = int(out[dp] * (1 - alpha) + r * alpha)
                    out[dp + 1] = int(out[dp + 1] * (1 - alpha) + g * alpha)
                    out[dp + 2] = int(out[dp + 2] * (1 - alpha) + b * alpha)

    def draw_heart(cx, cy, u, rgb):
        pts = [
            (-2, -1), (-1, -2), (1, -2), (2, -1),
            (-2, 0), (-1, -1), (0, -1), (1, -1), (2, 0),
            (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1), (0, 2),
        ]
        for dx, dy in pts:
            fill_rect(cx + dx * u - 1, cy + dy * u - 1, u + 2, u + 2, ol)
        for dx, dy in pts:
            fill_rect(cx + dx * u, cy + dy * u, u, u, rgb)

    def draw_star(cx, cy, u, rgb):
        fill_rect(cx - u * 0.5, cy - u * 2, u, u * 4, rgb)
        fill_rect(cx - u * 2, cy - u * 0.5, u * 4, u, rgb)
        fill_rect(cx - u * 0.5, cy - u * 0.5, u, u, (255, 253, 247))

    # 3. Festive colorful bunting garland along wall tops!
    def draw_garland(pA, pB, count):
        cols = [bs.hx("#F0464E"), bs.hx("#FFE042"), bs.hx("#69C795"), bs.hx("#5EABF7"), bs.hx("#FF85B0")]
        for i in range(count):
            t0 = (i + 0.12) / count
            t1 = (i + 0.88) / count
            tm = (i + 0.5) / count
            x0, y0 = pA[0] + (pB[0] - pA[0]) * t0, pA[1] + (pB[1] - pA[1]) * t0 + math.sin(t0 * math.pi) * 16
            x1, y1 = pA[0] + (pB[0] - pA[0]) * t1, pA[1] + (pB[1] - pA[1]) * t1 + math.sin(t1 * math.pi) * 16
            xm, ym = pA[0] + (pB[0] - pA[0]) * tm, pA[1] + (pB[1] - pA[1]) * tm + math.sin(tm * math.pi) * 16 + 20
            col = cols[i % len(cols)]
            # Rasterize tiny crisp flag triangle
            min_y, max_y = int(min(y0, y1, ym)), int(max(y0, y1, ym))
            min_x, max_x = int(min(x0, x1, xm)), int(max(x0, x1, xm))
            for py in range(max(0, min_y), min(OH, max_y + 1)):
                for px in range(max(0, min_x), min(OW, max_x + 1)):
                    # Barycentric test
                    d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1)
                    d2 = (px - xm) * (y1 - ym) - (x1 - xm) * (py - ym)
                    d3 = (px - x0) * (ym - y0) - (xm - x0) * (py - y0)
                    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
                    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
                    if not (has_neg and has_pos):
                        dp = (py * OW + px) * 4
                        out[dp], out[dp + 1], out[dp + 2] = col[0], col[1], col[2]

    draw_garland(w2s(-36, 6, 53), w2s(-36, -36, 54), 5)
    draw_garland(w2s(-36, -36, 54), w2s(34, -36, 54), 8)

    # 4. Warm oven fire radial glow!
    ox, oy = w2s(-20, -4, 27)
    glow_r = 92
    for y in range(max(0, int(oy - glow_r)), min(OH, int(oy + glow_r))):
        for x in range(max(0, int(ox - glow_r)), min(OW, int(ox + glow_r))):
            d = math.hypot(x - ox, y - oy) / glow_r
            if d < 1.0:
                a = (1.0 - d) * (1.0 - d) * 0.28
                dp = (y * OW + x) * 4
                out[dp] = min(255, int(out[dp] + 255 * a))
                out[dp + 1] = min(255, int(out[dp + 1] + 150 * a))
                out[dp + 2] = min(255, int(out[dp + 2] + 35 * a))

    # 5. Chimney rising pixel steam puffs + joyful sparkles & hearts!
    for sx, sy, sz, rad, alp in [
        (-36, -4, 70, 14, 0.85),
        (-34, -5, 77, 18, 0.72),
        (-37, -3, 85, 22, 0.52),
        (-33, -4, 93, 16, 0.32),
    ]:
        px, py = w2s(sx, sy, sz)
        fill_rect(px - rad * 0.5, py - rad * 0.5, rad, rad, (255, 253, 246), alp)
        fill_rect(px - rad * 0.75, py - rad * 0.25, rad * 1.5, rad * 0.5, (255, 253, 246), alp)

    # Warm sparkles near golden shelf breads & coins
    for wx, wy, wz in [(-14, -24, 46), (4, -24, 44), (32, -6, 33), (7, 10, 35)]:
        px, py = w2s(wx, wy, wz)
        draw_star(px, py, 3, bs.hx("#FFE245"))

    # Floating hearts above happy grandma holding croissant!
    gx, gy = w2s(-10, 47, 36)
    draw_heart(gx - 8, gy - 6, 4, bs.hx("#F0464E"))
    draw_heart(gx + 16, gy - 20, 3, bs.hx("#FF85B0"))

    # Thought bubble (heart icon!) above red-beret girl browsing
    bx_c, by_c = w2s(36, 31, 31)
    bw, bh = 68, 56
    bx, by = int(bx_c - bw * 0.5), int(by_c - bh - 10)
    fill_rect(bx - 3, by, bw + 6, bh, ol)
    fill_rect(bx, by - 3, bw, bh + 6, ol)
    fill_rect(bx, by, bw, bh, (255, 253, 246))
    fill_rect(bx_c - 4, by + bh + 3, 8, 5, ol)
    fill_rect(bx_c - 3, by + bh, 6, 5, (255, 253, 246))
    draw_heart(bx_c, by + bh * 0.5 - 2, 5, bs.hx("#F0464E"))

    # 6. Bottom wooden 5-shape tray (matching renderer.js pixel aesthetic!)
    shapes = ["melon", "croissant", "heart", "cinnamon", "baguette"]
    btn_s = 62
    gap = 10
    total_w = len(shapes) * btn_s + (len(shapes) - 1) * gap
    start_x = (OW - total_w) // 2
    ty = OH - btn_s - 28
    pad = 8
    fill_rect(start_x - pad - 3, ty - pad - 3, total_w + pad * 2 + 6, btn_s + pad * 2 + 6, ol)
    fill_rect(start_x - pad, ty - pad, total_w + pad * 2, btn_s + pad * 2, bs.hx("#B86B29"))
    fill_rect(start_x - pad + 3, ty - pad + 3, total_w + pad * 2 - 6, btn_s + pad * 2 - 8, bs.hx("#DF9842"))
    fill_rect(start_x - pad + 3, ty - pad + 3, total_w + pad * 2 - 6, 4, bs.hx("#F2B861"))

    # Render crisp mini sprite-stack icon inside each wooden button
    for idx, sh in enumerate(shapes):
        rx = start_x + idx * (btn_s + gap)
        sel = (sh == "heart")
        ry = ty - (4 if sel else 0)
        fill_rect(rx - 2, ry - 2, btn_s + 4, btn_s + 4, ol)
        fill_rect(rx, ry, btn_s, btn_s, bs.hx("#FFF5D6") if sel else bs.hx("#F3DEC0"))
        fill_rect(rx, ry + btn_s - 5, btn_s, 5, bs.hx("#FFE394") if sel else bs.hx("#E5C89E"))

        # Mini 28x24 icon buffer -> 2x blit into button center
        pinfo = props[f"{sh}_baked"]
        iw, ih = 28, 24
        ibuf = bytearray(iw * ih * 4)
        iang = 0.52
        ica, isa = math.cos(iang), math.sin(iang)
        pw, pd = pinfo["w"], pinfo["d"]
        for z, sbuf in enumerate(pinfo["slices"]):
            icx, icy = 14, 16 - z
            for py in range(ih):
                dy = (py - icy) / 0.56
                for px in range(iw):
                    dx = px - icx
                    ux = int(math.floor(dx * ica + dy * isa + pw * 0.5))
                    uy = int(math.floor(-dx * isa + dy * ica + pd * 0.5))
                    if 0 <= ux < pw and 0 <= uy < pd:
                        sp = (uy * pw + ux) * 4
                        if sbuf[sp + 3] > 128:
                            dp = (py * iw + px) * 4
                            ibuf[dp:dp + 4] = sbuf[sp:sp + 4]
        # 1px outline on icon
        iol = bytearray(ibuf)
        for y in range(1, ih - 1):
            for x in range(1, iw - 1):
                p = (y * iw + x) * 4
                if ibuf[p + 3] == 0:
                    if (ibuf[p - 4 + 3] > 128 or ibuf[p + 4 + 3] > 128 or
                        ibuf[p - iw * 4 + 3] > 128 or ibuf[p + iw * 4 + 3] > 128):
                        iol[p], iol[p + 1], iol[p + 2], iol[p + 3] = ol[0], ol[1], ol[2], 255
        # 2x blit centered in button
        ox0 = rx + (btn_s - iw * 2) // 2
        oy0 = ry + (btn_s - ih * 2) // 2
        for y in range(ih):
            for x in range(iw):
                p = (y * iw + x) * 4
                if iol[p + 3] > 128:
                    fill_rect(ox0 + x * 2, oy0 + y * 2, 2, 2, (iol[p], iol[p + 1], iol[p + 2]))

    tmp_png = os.path.join(TOOLS_DIR, "thumb_raw.png")
    bs.write_png(tmp_png, OW, OH, out)
    print(f"Saved {tmp_png} ({OW}x{OH})")

if __name__ == "__main__":
    main()
