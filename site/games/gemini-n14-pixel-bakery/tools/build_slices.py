#!/usr/bin/env python3
"""
Build sprite-stacking horizontal slices faithfully modeled after the
three reference sheets in ../refs/:
  - ref_bakery_front.jpg (front 3/4 view)
  - ref_bakery_back.jpg  (rear 3/4 view)
  - ref_items_chars.jpg  (breads, dough, tools, bowls, coins, 3 human customers)

Refined v2:
  - Cleaner brick courses & crisp oak grain (no striping)
  - Wider open brick oven mouth with clear view from kneading table
  - Non-overlapping rear layout: curved brick dome + chimney, window + flowerbox,
    burlap sacks + wooden crate, arched wooden back door with brass knob
  - Chubby, unmistakable bread silhouettes (melonpan, croissant, heart, cinnamon,
    baguette, jumbo loaf) and adorable 2-head-tall chibi customers
  - Pure Python stdlib only -> outputs PNG atlases + self-contained sprites_data.js
"""

import os
import math
import json
import zlib
import struct
import base64

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
TOOLS_DIR = os.path.join(BASE_DIR, "tools")

# ---------------------------------------------------------------------------
# Pure-Python RGBA PNG encoder
# ---------------------------------------------------------------------------
def write_png(path, width, height, rgba_bytes):
    def chunk(tag, data):
        return (
            struct.pack("!I", len(data))
            + tag
            + data
            + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 4
    mv = memoryview(rgba_bytes)
    for y in range(height):
        raw.append(0)
        raw.extend(mv[y * stride : (y + 1) * stride])

    ihdr = struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=6)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    if path:
        with open(path, "wb") as f:
            f.write(png)
    return png


# ---------------------------------------------------------------------------
# Color helpers & Reference-faithful Palette
# ---------------------------------------------------------------------------
def hx(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))

def shade_rgb(rgb, factor):
    r, g, b = rgb
    if factor < 1.0:
        r = int(max(0, min(255, r * (factor * 0.96 + 0.04))))
        g = int(max(0, min(255, g * factor * 0.97)))
        b = int(max(0, min(255, b * factor * 0.93)))
    else:
        r = int(max(0, min(255, r * factor + (factor - 1.0) * 24)))
        g = int(max(0, min(255, g * factor + (factor - 1.0) * 18)))
        b = int(max(0, min(255, b * factor + (factor - 1.0) * 10)))
    return (r, g, b)

PAL = {
    "outline":      hx("#2E1B14"),
    "dark_wood":    hx("#743E18"),
    "wood_rim":     hx("#BD6626"),
    "wood_rim_hi":  hx("#DF8B40"),
    "wood_rim_lo":  hx("#8C4618"),
    # Floor planks
    "floor_a":      hx("#E8A250"),
    "floor_b":      hx("#DC9040"),
    "floor_c":      hx("#CE8132"),
    "floor_line":   hx("#A66022"),
    # Cobblestone
    "stone_hi":     hx("#BDB9B3"),
    "stone_mid":    hx("#A09B95"),
    "stone_lo":     hx("#85807A"),
    "stone_gap":    hx("#5A5550"),
    # Terracotta brick
    "brick_hi":     hx("#EB8952"),
    "brick_a":      hx("#D9703E"),
    "brick_b":      hx("#C45C2F"),
    "brick_c":      hx("#AE4B24"),
    "brick_gap":    hx("#82361A"),
    # Oven interior & fire
    "oven_dark":    hx("#401B12"),
    "oven_warm":    hx("#8A3416"),
    "oven_glow":    hx("#DE561A"),
    "log_wood":     hx("#5E3016"),
    "log_hi":       hx("#854A24"),
    "fire_red":     hx("#F25A1A"),
    "fire_org":     hx("#FF9D26"),
    "fire_yel":     hx("#FFF26B"),
    # Cream stucco wall
    "wall_hi":      hx("#FCF4DE"),
    "wall_mid":     hx("#F3E6C4"),
    "wall_lo":      hx("#E0CFA6"),
    # Awning
    "awn_red":      hx("#DE3C3C"),
    "awn_red_lo":   hx("#B02828"),
    "awn_wht":      hx("#FFF9EC"),
    "awn_wht_lo":   hx("#E6DAC0"),
    # Mint window
    "mint_hi":      hx("#A2E8C6"),
    "mint_mid":     hx("#79CCA6"),
    "mint_lo":      hx("#54A37E"),
    "glass":        hx("#D4F2F5"),
    "glass_hi":     hx("#FFFFFF"),
    # Furniture oak wood
    "oak_hi":       hx("#F2B861"),
    "oak_a":        hx("#E29B44"),
    "oak_b":        hx("#CB8030"),
    "oak_c":        hx("#A86320"),
    "oak_lo":       hx("#7D4616"),
    # Kneading board
    "board_a":      hx("#EFC687"),
    "board_b":      hx("#D6A764"),
    "flour":        hx("#FFFFFF"),
    "flour_s":      hx("#F2E9D8"),
    # Brass register & coins
    "gold_hi":      hx("#FFF585"),
    "gold_a":       hx("#F7CB34"),
    "gold_b":       hx("#D69E1C"),
    "gold_lo":      hx("#996811"),
    # Dishes & toppings
    "dish_hi":      hx("#D0E6F5"),
    "dish_a":       hx("#9BC2DE"),
    "dish_lo":      hx("#6B93B0"),
    "berry_hi":     hx("#FF6E77"),
    "berry_a":      hx("#EA2B38"),
    "berry_lo":     hx("#B51A27"),
    "leaf_hi":      hx("#59BF53"),
    "leaf_a":       hx("#3B993A"),
    "leaf_lo":      hx("#256B27"),
    "choco_hi":     hx("#8A4A2A"),
    "choco_a":      hx("#5C2D17"),
    "choco_lo":     hx("#3D1C0D"),
    "butter_hi":    hx("#FFF285"),
    "butter_a":     hx("#FCD644"),
    "butter_lo":    hx("#DBA91F"),
    # Rear sacks & flowers
    "sack_hi":      hx("#E3C9A1"),
    "sack_a":       hx("#CBA97E"),
    "sack_lo":      hx("#A38158"),
    "flw_red":      hx("#F03A43"),
    "flw_yel":      hx("#FFE245"),
    "flw_pnk":      hx("#FF85B0"),
    "flw_blu":      hx("#5EABF7"),
    # Dough & breads
    "dough_hi":     hx("#FFFDF7"),
    "dough_a":      hx("#F7EEDC"),
    "dough_lo":     hx("#DED2BA"),
    "crust_hi":     hx("#FFE591"),
    "crust_a":      hx("#F7BA4D"),
    "crust_b":      hx("#E08D28"),
    "crust_c":      hx("#BA6416"),
    "crust_lo":     hx("#8C430E"),
    "icing":        hx("#FFFDF7"),
    "burnt_hi":     hx("#5E5A58"),
    "burnt_a":      hx("#3D3A38"),
    "burnt_lo":     hx("#242221"),
    # Customers
    "skin_hi":      hx("#FFE3C7"),
    "skin_a":       hx("#F9C9A4"),
    "skin_lo":      hx("#DDA27B"),
    "cheek":        hx("#F79494"),
    "hair_brn":     hx("#5E341E"),
    "hair_brn_hi":  hx("#804D30"),
    "hair_gry":     hx("#B0A59B"),
    "hair_gry_lo":  hx("#857A71"),
    "beret_hi":     hx("#F0464E"),
    "beret_a":      hx("#CC2631"),
    "beret_lo":     hx("#961721"),
    "dress_hi":     hx("#FFE35C"),
    "dress_a":      hx("#F5C12A"),
    "dress_lo":     hx("#C99414"),
    "shirt_w":      hx("#FFFDF7"),
    "blue_hi":      hx("#6FA2E5"),
    "blue_a":       hx("#4579C2"),
    "blue_lo":      hx("#2C5691"),
    "card_hi":      hx("#96E6BC"),
    "card_a":       hx("#69C795"),
    "card_lo":      hx("#459C6E"),
    "skirt_brn":    hx("#80573E"),
    "shoe":         hx("#4D2D1D"),
}


# ---------------------------------------------------------------------------
# Voxel Grid class
# ---------------------------------------------------------------------------
class VoxelModel:
    def __init__(self, w, d, h, ox=0, oy=0):
        self.w = w
        self.d = d
        self.h = h
        self.ox = ox
        self.oy = oy
        self.data = [None] * (w * d * h)

    def _idx(self, x, y, z):
        return (z * self.d + y) * self.w + x

    def set(self, wx, wy, z, col):
        x = wx - self.ox
        y = wy - self.oy
        if 0 <= x < self.w and 0 <= y < self.d and 0 <= z < self.h:
            self.data[self._idx(x, y, z)] = col

    def get(self, wx, wy, z):
        x = wx - self.ox
        y = wy - self.oy
        if 0 <= x < self.w and 0 <= y < self.d and 0 <= z < self.h:
            return self.data[self._idx(x, y, z)]
        return None

    def clear(self, wx, wy, z):
        self.set(wx, wy, z, None)

    def box(self, x0, x1, y0, y1, z0, z1, col_fn):
        is_fn = callable(col_fn)
        for z in range(z0, z1 + 1):
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    c = col_fn(x, y, z) if is_fn else col_fn
                    if c is not None:
                        self.set(x, y, z, c)

    def clear_box(self, x0, x1, y0, y1, z0, z1):
        for z in range(z0, z1 + 1):
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    self.clear(x, y, z)

    def bake_slices_rgba(self, ao_strength=0.14, top_boost=1.08, rim_color=None):
        w, d, h = self.w, self.d, self.h
        data = self.data
        slices = []
        for z in range(h):
            buf = bytearray(w * d * 4)
            z_off = z * d * w
            z_up = (z + 1) * d * w if z + 1 < h else -1
            for y in range(d):
                y_off = z_off + y * w
                for x in range(w):
                    rgb = data[y_off + x]
                    if rgb is None:
                        continue
                    above = data[z_up + y * w + x] if z_up >= 0 else None
                    # Check if this voxel is on the horizontal silhouette boundary
                    is_rim = (
                        x == 0 or x == w - 1 or y == 0 or y == d - 1 or
                        data[y_off + x - 1] is None or
                        data[y_off + x + 1] is None or
                        data[y_off - w + x] is None or
                        data[y_off + w + x] is None
                    )
                    if rim_color is not None and is_rim and (z <= 1 or above is not None):
                        # Crisp dark crust/contour edge so breads pop unmistakably off wooden shelves & tables!
                        if z == 0:
                            r, g, b = rim_color
                        else:
                            # Blend 55% toward rim_color on lower/side edges
                            r = int(rgb[0] * 0.48 + rim_color[0] * 0.52)
                            g = int(rgb[1] * 0.48 + rim_color[1] * 0.52)
                            b = int(rgb[2] * 0.48 + rim_color[2] * 0.52)
                    else:
                        factor = 1.0
                        if above is None:
                            factor *= top_boost
                            occ = 0
                            if z_up >= 0:
                                if x > 0 and data[z_up + y * w + (x - 1)] is not None: occ += 1
                                if x + 1 < w and data[z_up + y * w + (x + 1)] is not None: occ += 1
                                if y > 0 and data[z_up + (y - 1) * w + x] is not None: occ += 1
                                if y + 1 < d and data[z_up + (y + 1) * w + x] is not None: occ += 1
                            if occ > 0:
                                factor *= (1.0 - ao_strength * min(occ, 3) * 0.5)
                        else:
                            factor *= (0.91 + 0.08 * (z / max(1, h - 1)))
                        r, g, b = shade_rgb(rgb, factor)

                    p = (y * w + x) * 4
                    buf[p] = r
                    buf[p + 1] = g
                    buf[p + 2] = b
                    buf[p + 3] = 255
            slices.append(buf)
        return slices


# ---------------------------------------------------------------------------
# 1. Build the Bakery Shop Diorama (128 x 128 x 68)
# ---------------------------------------------------------------------------
def build_bakery_shop():
    W, D, H = 128, 128, 68
    m = VoxelModel(W, D, H, ox=-64, oy=-64)
    R = 59.5

    # --- A. Circular Wooden Turntable Base (z = 0..7) ---
    for z in range(0, 8):
        for y in range(-61, 62):
            for x in range(-61, 62):
                r = math.hypot(x, y)
                if r > R:
                    continue
                if z == 0:
                    m.set(x, y, z, PAL["outline"] if r > R - 1.5 else PAL["wood_rim_lo"])
                elif z <= 6:
                    if r > R - 2.4:
                        ang = int((math.atan2(y, x) + math.pi) * 14)
                        if z == 6:
                            c = PAL["wood_rim_hi"] if (ang % 3 != 0) else PAL["wood_rim"]
                        elif z <= 2:
                            c = PAL["wood_rim_lo"]
                        else:
                            c = PAL["wood_rim"] if (ang % 4 != 0) else PAL["wood_rim_lo"]
                        m.set(x, y, z, c)
                    else:
                        m.set(x, y, z, PAL["wood_rim_lo"])
                else:
                    if r > R - 2.4:
                        m.set(x, y, z, PAL["wood_rim_hi"])
                        continue
                    in_front_cobble = (x + y > 28 and r > 35) or (y > 31 and x > -34 and r > 38)
                    in_rear_curb = (r > R - 6.6) and (x < -8 or y < -8) and not in_front_cobble
                    if in_front_cobble or in_rear_curb:
                        bx = (x + 120) // 6
                        by = (y + 120 + (bx % 2) * 3) // 5
                        lx = (x + 120) % 6
                        ly = (y + 120 + (bx % 2) * 3) % 5
                        if lx == 0 or ly == 0:
                            c = PAL["stone_gap"]
                        else:
                            hval = (bx * 37 + by * 17) % 5
                            c = PAL["stone_hi"] if hval == 0 else (PAL["stone_mid"] if hval <= 2 else PAL["stone_lo"])
                        m.set(x, y, z, c)
                    else:
                        plank_idx = (y + 64) // 5
                        in_gap = ((y + 64) % 5 == 0)
                        joint = ((x + 64 + plank_idx * 13) % 22 == 0)
                        if in_gap or joint:
                            c = PAL["floor_line"]
                        else:
                            v = (plank_idx * 7 + (x // 12)) % 3
                            c = PAL["floor_a"] if v == 0 else (PAL["floor_b"] if v == 1 else PAL["floor_c"])
                        m.set(x, y, z, c)

    # Raised cobble relief on z = 8
    for y in range(-58, 59):
        for x in range(-58, 59):
            r = math.hypot(x, y)
            if r > R - 2.7:
                continue
            in_front_cobble = (x + y > 28 and r > 35.5) or (y > 31 and x > -34 and r > 38.5)
            in_rear_curb = (r > R - 6.4) and (x < -8 or y < -8) and not in_front_cobble
            if in_front_cobble or in_rear_curb:
                bx = (x + 120) // 6
                by = (y + 120 + (bx % 2) * 3) // 5
                lx = (x + 120) % 6
                ly = (y + 120 + (bx % 2) * 3) % 5
                if 1 <= lx <= 5 and 1 <= ly <= 4:
                    hval = (bx * 37 + by * 17) % 5
                    c = PAL["stone_hi"] if hval == 0 else (PAL["stone_mid"] if hval <= 2 else PAL["stone_lo"])
                    m.set(x, y, 8, c)

    # --- Brick pattern helper (clean 4-slice courses, soft mortar) ---
    def brick_col(x, y, z):
        row = z // 4
        rz = z % 4
        if rz == 0:
            return PAL["brick_gap"]
        shift = (row % 2) * 3
        pos = (x + y + 200 + shift) % 7
        if pos == 0:
            return PAL["brick_gap"]
        h = ((x + y + 200 + shift) // 7 * 13 + row * 7) % 4
        return [PAL["brick_hi"], PAL["brick_a"], PAL["brick_b"], PAL["brick_c"]][h]

    # --- B. Left-Back Terracotta Brick Wall (x = -38..-34, y = -38..28) ---
    for y in range(-38, 29):
        if y <= 6:
            max_z = 52
        elif y <= 12:
            max_z = 46
        elif y <= 18:
            max_z = 40
        elif y <= 23:
            max_z = 34
        else:
            max_z = 28
        for z in range(8, max_z + 1):
            for x in range(-38, -33):
                if z >= max_z - 1 and y <= 6:
                    c = PAL["oak_hi"] if z == max_z else PAL["oak_b"]
                elif z == max_z and y > 6:
                    c = PAL["brick_hi"]
                else:
                    c = brick_col(x, y, z)
                m.set(x, y, z, c)

    # --- C. Right-Back Cream Stucco Wall (y = -38..-34, x = -38..36) ---
    for x in range(-38, 37):
        for z in range(8, 53):
            for y in range(-38, -33):
                is_post = (x <= -34) or (x >= 33) or (x in (2, 3, 4) and y <= -36)
                if z >= 51:
                    c = PAL["oak_hi"] if z == 52 else PAL["oak_b"]
                elif is_post:
                    c = PAL["oak_a"] if (z % 5 != 0) else PAL["oak_b"]
                elif z <= 10:
                    c = PAL["stone_mid"] if y <= -36 else PAL["oak_c"]
                else:
                    v = (x * 3 + z * 5) % 13
                    c = PAL["wall_hi"] if v < 5 else (PAL["wall_mid"] if v < 11 else PAL["wall_lo"])
                m.set(x, y, z, c)

    # --- D. Red & White Striped Awning (both inside & outside!) ---
    for x in range(-33, 35):
        stripe = ((x + 34) // 5) % 2 == 0
        c_hi = PAL["awn_red"] if stripe else PAL["awn_wht"]
        c_lo = PAL["awn_red_lo"] if stripe else PAL["awn_wht_lo"]
        lx = (x + 34) % 5
        scallop = 1 if (lx in (1, 2, 3)) else 0
        for dy in range(0, 4):
            z_top = 50 - dy // 2
            z_bot = z_top - 2 - (scallop if dy == 3 else 0)
            for z in range(z_bot, z_top + 1):
                m.set(x, -33 + dy, z, c_hi if z >= z_top - 1 else c_lo)
        for dy in range(0, 5):
            z_top = 50 - dy // 2
            z_bot = z_top - 2 - (scallop if dy == 4 else 0)
            for z in range(z_bot, z_top + 1):
                m.set(x, -39 - dy, z, c_hi if z >= z_top - 1 else c_lo)

    # --- E. Mint Green Window in Right-Back Wall (x = 12..27, z = 24..40) ---
    m.clear_box(13, 26, -39, -32, 25, 39)
    for x in range(12, 28):
        for z in range(24, 41):
            on_frame = (x in (12, 13, 26, 27)) or (z in (24, 25, 39, 40))
            on_mullion = (x in (19, 20)) or (z == 32)
            for y in range(-38, -33):
                if on_frame or on_mullion:
                    c = PAL["mint_hi"] if (z >= 39 or z == 32) else (PAL["mint_mid"] if y in (-34, -38) else PAL["mint_lo"])
                    m.set(x, y, z, c)
                elif y == -36 and (x + z) % 7 == 0 and z > 33:
                    m.set(x, y, z, PAL["glass_hi"])
    # Interior window sill
    m.box(11, 28, -34, -31, 23, 25, lambda x, y, z: PAL["mint_hi"] if z == 25 else PAL["mint_mid"])

    # --- F. Rear Exterior Details (clean, zero overlap, faithful to ref_bakery_back.jpg!) ---
    # 1) Flowerbox under exterior window (x = 12..27, y = -43..-39, z = 19..25)
    m.box(12, 27, -43, -39, 19, 22, lambda x, y, z: PAL["oak_hi"] if z == 22 else (PAL["oak_b"] if x % 3 != 0 else PAL["oak_lo"]))
    for x in range(13, 27):
        for y in range(-42, -39):
            m.set(x, y, 23, PAL["leaf_a"] if (x + y) % 2 == 0 else PAL["leaf_hi"])
            if (x + y) % 3 == 0:
                m.set(x, y, 24, PAL["leaf_hi"])
    for fx, fy, fc in [
        (14, -41, PAL["flw_red"]), (17, -42, PAL["flw_yel"]),
        (20, -40, PAL["flw_red"]), (23, -42, PAL["flw_yel"]),
        (25, -41, PAL["flw_red"]), (16, -40, PAL["flw_pnk"]),
    ]:
        m.set(fx, fy, 24, fc)
        m.set(fx, fy, 25, fc)

    # 2) Stacked Burlap Flour Sacks directly below window/flowerbox (x = 11..28, y = -50..-41)
    def add_sack(cx, cy, z0):
        for z in range(z0, z0 + 4):
            for y in range(cy - 4, cy + 5):
                for x in range(cx - 5, cx + 6):
                    dx = (x - cx) / 5.1
                    dy = (y - cy) / 4.0
                    dz = (z - (z0 + 1.5)) / 2.2
                    if dx * dx + dy * dy + dz * dz <= 1.12:
                        c = PAL["sack_hi"] if z == z0 + 3 else (PAL["sack_a"] if z >= z0 + 1 else PAL["sack_lo"])
                        m.set(x, y, z, c)

    add_sack(23, -46, 8)
    add_sack(23, -46, 12)
    add_sack(23, -46, 16)
    add_sack(13, -46, 8)
    add_sack(13, -46, 12)

    # 3) Wooden Crate beside flour sacks (x = 1..9, y = -48..-40, z = 8..16)
    for z in range(8, 17):
        for y in range(-48, -39):
            for x in range(1, 10):
                edge = (x in (1, 9)) or (y in (-48, -40)) or (z in (8, 16))
                slat = (z in (11, 14))
                c = PAL["oak_hi"] if (z == 16 and edge) else (PAL["oak_b"] if edge else (PAL["oak_c"] if slat else PAL["oak_a"]))
                m.set(x, y, z, c)

    # 4) Arched Wooden Back Door with Brass Knob (x = -19..-9, y = -40..-39, z = 8..27)
    # 2px protruding thickness so door arch & planks read crisply from every rear angle!
    for z in range(8, 28):
        for x in range(-19, -8):
            dx = (x - (-14.0)) / 5.2
            if z > 21 and dx * dx + ((z - 21) / 5.8) ** 2 > 1.0:
                continue
            border = (x in (-19, -9)) or (z >= 26) or (z > 21 and dx * dx + ((z - 21) / 4.8) ** 2 > 0.84)
            plank = (x in (-16, -12))
            c = PAL["oak_lo"] if border else (PAL["oak_c"] if plank else PAL["oak_a"])
            m.set(x, -39, z, c)
            m.set(x, -40, z, c)
    # Brass doorknob
    m.set(-11, -41, 16, PAL["gold_hi"])
    m.set(-11, -41, 15, PAL["gold_a"])

    # --- G. Terracotta Brick Wood-Fired Oven (Wide glowing mouth + curved rear dome!) ---
    OVEN_CX, OVEN_CY = -33, -4
    for z in range(8, 52):
        for y in range(-22, 15):
            for x in range(-51, -15):
                dy = y - OVEN_CY
                if z <= 18:
                    if x >= -35:
                        if x <= -17 and abs(dy) <= 14:
                            if x >= -31 and abs(dy) <= 7 and z <= 16:
                                if (dy / 7.5) ** 2 + max(0, (z - 11) / 5.5) ** 2 < 1.0:
                                    if z <= 12 and x <= -21 and ((z + y) % 3 != 0):
                                        m.set(x, y, z, PAL["log_hi"] if z % 2 == 0 else PAL["log_wood"])
                                    continue
                            m.set(x, y, z, brick_col(x, y, z))
                    else:
                        rx = (x - (-35)) / 15.0
                        ry = dy / 15.0
                        if rx * rx + ry * ry <= 1.0:
                            m.set(x, y, z, brick_col(x, y, z))
                elif z <= 20:
                    if x >= -35:
                        if x <= -15 and abs(dy) <= 15:
                            c = PAL["brick_hi"] if (z == 20 and x >= -18) else brick_col(x, y, z)
                            m.set(x, y, z, c)
                    else:
                        rx = (x - (-35)) / 15.5
                        ry = dy / 15.5
                        if rx * rx + ry * ry <= 1.0:
                            m.set(x, y, z, PAL["brick_hi"] if z == 20 else brick_col(x, y, z))
                else:
                    t = (z - 21) / 30.0
                    dome_r = 15.0 * math.sqrt(max(0.0, 1.0 - t * t * 0.90))
                    if dome_r < 2.5:
                        continue
                    if x >= -35:
                        if x <= -18 and abs(dy) <= dome_r:
                            # Generous open arched baking mouth so dough/bread inside is clearly visible!
                            in_arch = (abs(dy) <= 9.5 and z <= 38 and
                                       ((dy / 9.8) ** 2 + max(0, (z - 28) / 10.2) ** 2) < 1.0)
                            if in_arch and x >= -33:
                                if x <= -31:
                                    m.set(x, y, z, PAL["oven_glow"] if z <= 27 else PAL["oven_warm"])
                                elif z == 21 and x <= -19:
                                    m.set(x, y, z, PAL["oven_glow"] if x < -26 else PAL["oven_warm"])
                                continue
                            ring = (abs(dy) <= 11.5 and z <= 40 and
                                    ((dy / 11.8) ** 2 + max(0, (z - 28) / 11.8) ** 2) < 1.0 and x >= -20)
                            c = PAL["brick_hi"] if ring and (y + z) % 2 == 0 else brick_col(x, y, z)
                            m.set(x, y, z, c)
                    else:
                        rx = (x - (-35)) / max(1.0, dome_r)
                        ry = dy / max(1.0, dome_r)
                        if rx * rx + ry * ry <= 1.0:
                            m.set(x, y, z, brick_col(x, y, z))

    # --- H. Brick Chimney rising above oven (z = 46..67) ---
    CH_X, CH_Y = -36, -4
    for z in range(46, 68):
        rad = 6 if z >= 63 else 5
        for y in range(CH_Y - rad, CH_Y + rad + 1):
            for x in range(CH_X - rad, CH_X + rad + 1):
                if z >= 63 and abs(x - CH_X) <= 2 and abs(y - CH_Y) <= 2:
                    if z == 63:
                        m.set(x, y, z, PAL["oven_dark"])
                    continue
                c = PAL["brick_hi"] if z == 67 else brick_col(x, y, z)
                m.set(x, y, z, c)

    # --- I. Wooden 3-Tier Bread Display Shelf (x = -23..6, y = -33..-21, z = 8..46) ---
    SX0, SX1 = -23, 6
    SY0, SY1 = -33, -21
    m.box(SX0, SX1, SY0, SY1, 8, 15, lambda x, y, z:
          PAL["oak_lo"] if (x in (SX0, SX1) or x == -8 or z == 8) else (PAL["oak_a"] if z == 15 else PAL["oak_c"]))
    for px in (SX0, SX0 + 1, SX1 - 1, SX1):
        for py in (SY0, SY0 + 1, SY1 - 1, SY1):
            for z in range(16, 46):
                m.set(px, py, z, PAL["oak_hi"] if z == 45 else PAL["oak_b"])
    # Warm shaded walnut back panel so golden breads POP vividly off the display shelf!
    for x in range(SX0 + 2, SX1 - 1):
        for z in range(16, 44):
            m.set(x, SY0, z, PAL["oak_lo"] if x % 4 == 0 else PAL["oak_c"])
    # 3 display tiers at z = 16, 26, 36
    for sz in (16, 26, 36):
        m.box(SX0, SX1, SY0, SY1, sz, sz + 1, lambda x, y, z:
              PAL["oak_hi"] if (z == sz + 1 and y >= SY1 - 1) else (PAL["oak_b"] if z == sz + 1 else PAL["oak_c"]))
    m.box(SX0, SX1, SY0, SY1, 44, 45, lambda x, y, z: PAL["oak_hi"] if z == 45 else PAL["oak_b"])

    # --- J. Central Oak Kneading Table (shifted slightly forward-right for clear oven view!) ---
    # x = -7..19, y = 2..22, z = 8..20
    TX0, TX1 = -7, 19
    TY0, TY1 = 2, 22
    for lx in (TX0 + 1, TX1 - 3):
        for ly in (TY0 + 1, TY1 - 3):
            m.box(lx, lx + 2, ly, ly + 2, 8, 17, PAL["oak_b"])
    m.box(TX0 + 2, TX1 - 2, TY0 + 2, TY0 + 2, 11, 12, PAL["oak_c"])
    m.box(TX0 + 2, TX1 - 2, TY1 - 2, TY1 - 2, 11, 12, PAL["oak_c"])
    m.box(TX0 + 2, TX0 + 2, TY0 + 2, TY1 - 2, 11, 12, PAL["oak_c"])
    m.box(TX1 - 2, TX1 - 2, TY0 + 2, TY1 - 2, 11, 12, PAL["oak_c"])
    m.box(TX0 + 1, TX1 - 1, TY0 + 1, TY1 - 1, 16, 17, PAL["oak_c"])
    for z in range(18, 21):
        for y in range(TY0, TY1 + 1):
            for x in range(TX0, TX1 + 1):
                if z == 20:
                    if y in (TY0, TY1) or x in (TX0, TX1):
                        c = PAL["oak_a"]
                    elif (y - TY0) % 5 == 0:
                        c = PAL["oak_b"]
                    else:
                        c = PAL["oak_hi"]
                else:
                    c = PAL["oak_b"] if z == 19 else PAL["oak_c"]
                m.set(x, y, z, c)

    # Wooden Kneading Board in center of table (x = 0..14, y = 4..16, z = 21)
    for y in range(4, 17):
        for x in range(0, 15):
            dist = math.hypot((x - 7) / 6.2, (y - 10) / 5.2)
            if dist < 0.72 and ((x * 7 + y * 13) % 5 != 0):
                c = PAL["flour"] if dist < 0.45 else PAL["flour_s"]
            elif x in (0, 14) or y in (4, 16):
                c = PAL["board_b"]
            else:
                c = PAL["board_a"]
            m.set(x, y, 21, c)

    # Wooden Flour Bowl on left of table (center x = -4, y = 11, z = 21..26)
    for z in range(21, 27):
        for y in range(7, 16):
            for x in range(-8, 1):
                r = math.hypot(x - (-4), y - 11)
                if z <= 24:
                    max_r = 2.6 + (z - 21) * 0.55
                    if r <= max_r:
                        if z >= 23 and r <= max_r - 1.1:
                            m.set(x, y, z, PAL["flour"])
                        else:
                            m.set(x, y, z, PAL["oak_a"] if z == 24 else PAL["oak_c"])
                else:
                    mound_r = 2.5 - (z - 24) * 0.95
                    if r <= mound_r:
                        m.set(x, y, z, PAL["flour"] if z == 26 else PAL["flour_s"])

    # 3 Topping Bowls along front edge of table (y = 19, z = 21..24)
    def add_topping_dish(cx, cy, top_fn):
        for z in range(21, 25):
            for y in range(cy - 3, cy + 4):
                for x in range(cx - 3, cx + 4):
                    r = math.hypot(x - cx, y - cy)
                    if z <= 23:
                        max_r = 2.1 + (z - 21) * 0.45
                        if r <= max_r:
                            if z == 23 and r <= max_r - 0.85:
                                m.set(x, y, z, top_fn(x - cx, y - cy, z))
                            else:
                                m.set(x, y, z, PAL["dish_hi"] if z == 23 else (PAL["dish_a"] if z == 22 else PAL["dish_lo"]))
                    else:
                        if r <= 1.8:
                            m.set(x, y, z, top_fn(x - cx, y - cy, z))

    add_topping_dish(-1, 19, lambda dx, dy, z:
        PAL["leaf_hi"] if (z == 24 and dx == 0 and dy == 0) else (PAL["berry_hi"] if (dx + dy) % 2 == 0 else PAL["berry_a"]))
    add_topping_dish(6, 19, lambda dx, dy, z:
        PAL["choco_hi"] if (dx * 3 + dy) % 2 == 0 else PAL["choco_a"])
    add_topping_dish(13, 19, lambda dx, dy, z:
        PAL["butter_hi"] if z == 24 else PAL["butter_a"])

    # --- K. Front-Right Cash Register Counter + Brass Register + Coin Dish ---
    # Counter at x = 25..39, y = -20..-4, z = 8..20
    RX0, RX1, RY0, RY1 = 25, 39, -20, -4
    m.box(RX0, RX1, RY0, RY1, 8, 18, lambda x, y, z:
          PAL["oak_lo"] if (z == 8 or x in (RX0, RX1) or y in (RY0, RY1)) else (PAL["oak_b"] if (y % 4 == 0) else PAL["oak_a"]))
    m.box(RX0 - 1, RX1 + 1, RY0 - 1, RY1 + 1, 19, 20, lambda x, y, z: PAL["oak_hi"] if z == 20 else PAL["oak_b"])

    # Brass Cash Register (x = 28..37, y = -18..-10, z = 21..32)
    for z in range(21, 33):
        for y in range(-18, -9):
            for x in range(28, 38):
                if z <= 23:
                    c = PAL["oak_lo"] if z == 21 else PAL["gold_lo"]
                elif z <= 27:
                    if y >= -12 and z > 25:
                        continue
                    c = PAL["gold_hi"] if (y == -12 and x % 2 == 0) else (PAL["gold_a"] if x % 3 != 0 else PAL["gold_b"])
                else:
                    if y > -14:
                        continue
                    c = PAL["gold_hi"] if z == 32 else (PAL["gold_a"] if y == -14 else PAL["gold_b"])
                m.set(x, y, z, c)

    # Small Coin Tray on front of counter (x = 29..35, y = -8..-4, z = 21..22)
    for y in range(-8, -3):
        for x in range(29, 36):
            r = math.hypot(x - 32, y - (-6))
            if r <= 3.0:
                m.set(x, y, 21, PAL["gold_lo"] if r > 2.2 else PAL["oak_c"])
                if r > 2.2:
                    m.set(x, y, 22, PAL["gold_b"])

    # --- L. Wooden Trash Bin (x = 25..32, y = 4..11, z = 8..16) ---
    for z in range(8, 17):
        t = (z - 8) / 8.0
        half = 3.0 + t * 0.9
        for y in range(3, 13):
            for x in range(24, 34):
                dx = abs(x - 28.5)
                dy = abs(y - 7.5)
                if dx <= half and dy <= half:
                    inner = (dx <= half - 1.1 and dy <= half - 1.1 and z >= 10)
                    if inner:
                        if z == 10:
                            m.set(x, y, z, PAL["outline"])
                        continue
                    c = PAL["oak_hi"] if z == 16 else (PAL["oak_b"] if (x + y) % 2 == 0 else PAL["oak_c"])
                    m.set(x, y, z, c)

    return m


# ---------------------------------------------------------------------------
# 2. Chubby, Unmistakable Breads, Toppings & 2-Head-Tall Cute Customers
# ---------------------------------------------------------------------------
def build_dough_or_bread(shape, state="baked"):
    if state == "raw":
        c_hi, c_a, c_b, c_lo = PAL["dough_hi"], PAL["dough_a"], PAL["dough_a"], PAL["dough_lo"]
    elif state == "burnt":
        c_hi, c_a, c_b, c_lo = PAL["burnt_hi"], PAL["burnt_a"], PAL["burnt_a"], PAL["burnt_lo"]
    else:
        c_hi, c_a, c_b, c_lo = PAL["crust_hi"], PAL["crust_a"], PAL["crust_b"], PAL["crust_c"]

    if shape == "jumbo":
        W, D, H = 24, 24, 14
        m = VoxelModel(W, D, H, ox=-12, oy=-12)
        for z in range(13):
            for y in range(-6, 7):
                for x in range(-10, 11):
                    if z <= 7:
                        if abs(x) <= 9 and abs(y) <= 5:
                            c = c_b if (abs(x) == 9 or abs(y) == 5 or z < 2) else c_a
                            m.set(x, y, z, c)
                    else:
                        dz = (z - 7) / 5.2
                        dy = y / 5.8
                        dx = x / 9.8
                        if dy * dy + dz * dz <= 1.0 and abs(dx) <= 1.0 - dz * 0.12:
                            score = (z >= 10 and ((x + 12) % 5 == 0) and abs(y) <= 3)
                            c = c_hi if score else (c_a if z >= 10 else c_b)
                            m.set(x, y, z, c)
        return m

    W, D, H = 20, 20, 10
    m = VoxelModel(W, D, H, ox=-10, oy=-10)

    if shape == "dough":
        for z in range(8):
            for y in range(-8, 9):
                for x in range(-8, 9):
                    r = math.hypot(x / 7.2, y / 6.8)
                    hz = (z - 1.5) / 5.5
                    if r * r + max(0, hz) ** 2 <= 1.0 and z <= 6:
                        c = c_hi if (z >= 5 and r < 0.65) else (c_a if z >= 2 else c_lo)
                        m.set(x, y, z, c)
        return m

    if shape == "melon":
        for z in range(8):
            for y in range(-8, 9):
                for x in range(-8, 9):
                    r = math.hypot(x / 7.4, y / 7.4)
                    hz = (z - 1.5) / 5.8
                    if r * r + max(0, hz) ** 2 <= 1.0 and z <= 6:
                        grid = ((x + y + 20) % 4 == 0) or ((x - y + 20) % 4 == 0)
                        if z >= 3 and grid:
                            c = c_b if state != "raw" else c_lo
                        else:
                            c = c_hi if z >= 5 else (c_a if z >= 3 else c_b)
                        m.set(x, y, z, c)
        return m

    if shape == "croissant":
        for z in range(8):
            for y in range(-8, 9):
                for x in range(-9, 10):
                    ys = 0.095 * x * x - 3.2
                    dist = abs(y - ys)
                    t = abs(x) / 9.0
                    if t > 1.0:
                        continue
                    rad = 3.8 * (1.0 - 0.72 * t * t)
                    h_max = 6.5 * (1.0 - 0.60 * t * t)
                    if dist <= rad and z <= h_max:
                        dz = (z - 1.0) / max(1.0, h_max - 0.8)
                        if (dist / rad) ** 2 + max(0, dz) ** 2 <= 1.08:
                            ridge = (abs(x) in (2, 5))
                            c = c_lo if (ridge and z >= 3) else (c_hi if z >= h_max - 1.6 else (c_a if z >= 3 else c_b))
                            m.set(x, y, z, c)
        return m

    if shape == "heart":
        # Crisp, unmistakable plump heart shape!
        for z in range(8):
            for y in range(-8, 9):
                for x in range(-8, 9):
                    nx = x / 6.0
                    ny = -(y - 1.2) / 5.6
                    val = (nx * nx + ny * ny - 1.0) ** 3 - nx * nx * (ny ** 3)
                    if val <= 0.04:
                        depth = min(1.0, max(0.0, -val * 1.4 + 0.25))
                        h_lim = 2.8 + 4.0 * (depth ** 0.45)
                        if z <= h_lim:
                            c = c_hi if (z >= h_lim - 1.3 and depth > 0.32) else (c_a if z >= 3 else c_b)
                            m.set(x, y, z, c)
        return m

    if shape == "cinnamon":
        for z in range(8):
            for y in range(-8, 9):
                for x in range(-8, 9):
                    r = math.hypot(x, y)
                    if r <= 7.0 and z <= 6:
                        ang = math.atan2(y, x)
                        spiral = (r * 1.45 + ang * 1.1) % (math.pi * 1.45)
                        is_groove = (spiral < 0.78)
                        h_top = 5 if is_groove else 6
                        if z <= h_top:
                            if z >= 5 and not is_groove and state == "baked" and r < 5.6 and (x + y) % 3 != 0:
                                c = PAL["icing"]
                            elif is_groove and z >= 4:
                                c = c_lo
                            else:
                                c = c_hi if z >= 5 else (c_a if z >= 3 else c_b)
                            m.set(x, y, z, c)
        return m

    if shape == "baguette":
        for z in range(7):
            for y in range(-4, 5):
                for x in range(-9, 10):
                    rx = x / 9.5
                    ry = y / 3.4
                    r2 = rx * rx * 0.75 + ry * ry
                    if r2 <= 1.0:
                        h_lim = 5.5 * math.sqrt(max(0.0, 1.0 - r2 * 0.85))
                        if z <= h_lim:
                            slash = (z >= h_lim - 1.4 and ((x + y + 18) % 5 == 0) and abs(x) <= 7)
                            c = c_hi if slash else (c_a if z >= 3 else c_b)
                            m.set(x, y, z, c)
        return m

    return m


def build_topping(kind):
    W, D, H = 16, 16, 9
    m = VoxelModel(W, D, H, ox=-8, oy=-8)
    if kind == "strawberry":
        for z in range(0, 2):
            for y in range(-4, 5):
                for x in range(-4, 5):
                    if math.hypot(x, y) <= 3.6 - z * 0.4:
                        m.set(x, y, z, PAL["icing"] if z == 1 else PAL["dough_a"])
        for z in range(2, 7):
            rad = 2.7 - abs(z - 3.8) * 0.52
            for y in range(-3, 4):
                for x in range(-3, 4):
                    if math.hypot(x, y) <= rad:
                        seed = ((x + y + z) % 3 == 0 and z in (3, 4))
                        c = PAL["butter_hi"] if seed else (PAL["berry_hi"] if z >= 5 else (PAL["berry_a"] if z >= 3 else PAL["berry_lo"]))
                        m.set(x, y, z, c)
        for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
            m.set(dx, dy, 7, PAL["leaf_hi"] if (dx == 0 and dy == 0) else PAL["leaf_a"])
        m.set(0, 0, 8, PAL["leaf_hi"])
    elif kind == "choco":
        for z in range(0, 4):
            for y in range(-5, 6):
                for x in range(-5, 6):
                    r = math.hypot(x, y)
                    if r > 5.0:
                        continue
                    stripe = ((x + y + 10) % 3 == 0)
                    if z <= 1 and stripe:
                        m.set(x, y, z, PAL["choco_a"])
                    elif z == 2 and stripe and r <= 4.0:
                        m.set(x, y, z, PAL["choco_hi"] if (x - y) % 2 == 0 else PAL["choco_a"])
        for cx, cy in [(-2, -1), (2, 0), (0, 2), (-1, 2), (1, -2)]:
            m.set(cx, cy, 3, PAL["choco_hi"])
    elif kind == "butter":
        for y in range(-3, 4):
            for x in range(-3, 4):
                if abs(x) <= 2 and abs(y) <= 2:
                    m.set(x, y, 0, PAL["butter_lo"])
                    m.set(x, y, 1, PAL["butter_a"])
                    m.set(x, y, 2, PAL["butter_hi"])
        for sx, sy in [(-4, 0), (4, 1), (0, -4), (1, 4), (-3, 3), (3, -3)]:
            m.set(sx, sy, 0, PAL["flour"])
    return m


def build_customer(kind, step=0):
    """Adorable chunky 2-head-tall chibi human customers (18x18x22) faithful to ref_items_chars.jpg!"""
    W, D, H = 18, 18, 22
    m = VoxelModel(W, D, H, ox=-9, oy=-9)

    leg_l_y = 1 if step == 0 else -1
    leg_r_y = -1 if step == 0 else 1

    # Shoes & short chibi legs (z = 0..3)
    for sx, ly in [(-2, leg_l_y), (2, leg_r_y)]:
        m.box(sx - 1, sx + 1, ly - 1, ly + 2, 0, 1, PAL["shoe"])
        leg_col = PAL["blue_a"] if kind == "boy" else (PAL["skin_a"] if kind == "girl" else PAL["skirt_brn"])
        m.box(sx - 1, sx + 1, ly - 1, ly + 1, 2, 3, leg_col)

    # Torso / Clothes (z = 4..10)
    if kind == "girl":
        for z in range(4, 11):
            rx = 4 if z <= 6 else 3
            ry = 3 if z <= 6 else 2
            for y in range(-ry, ry + 1):
                for x in range(-rx, rx + 1):
                    if abs(x) == rx and abs(y) == ry and z > 5:
                        continue
                    if z >= 9 and abs(x) <= 1 and y >= 1:
                        c = PAL["beret_hi"] if (z == 10 and x == 0) else PAL["shirt_w"]
                    elif z >= 8 and abs(x) >= 3:
                        c = PAL["shirt_w"]
                    else:
                        c = PAL["dress_hi"] if z >= 9 else (PAL["dress_a"] if z >= 6 else PAL["dress_lo"])
                    m.set(x, y, z, c)
    elif kind == "boy":
        for z in range(4, 11):
            for y in range(-2, 3):
                for x in range(-3, 4):
                    if z >= 8 and abs(x) == 3:
                        c = PAL["shirt_w"]
                    elif z >= 9 and x == 0 and y >= 1:
                        c = PAL["shirt_w"]
                    else:
                        c = PAL["blue_hi"] if (z == 9 and abs(x) == 2 and y == 2) else (PAL["blue_a"] if z >= 6 else PAL["blue_lo"])
                    m.set(x, y, z, c)
    else:
        for z in range(3, 7):
            for y in range(-3, 4):
                for x in range(-4, 5):
                    if abs(x) == 4 and abs(y) == 3:
                        continue
                    m.set(x, y, z, PAL["skirt_brn"])
        for z in range(7, 11):
            for y in range(-3, 3):
                for x in range(-4, 5):
                    if abs(x) == 4 and abs(y) == 3:
                        continue
                    c = PAL["shirt_w"] if (x == 0 and y >= 1) else (PAL["card_hi"] if z >= 10 else (PAL["card_a"] if z >= 8 else PAL["card_lo"]))
                    m.set(x, y, z, c)
        # Woven basket
        m.box(-6, -4, 0, 3, 4, 7, lambda x, y, z: PAL["oak_hi"] if (x + y + z) % 2 == 0 else PAL["oak_b"])
        m.set(-5, 1, 8, PAL["oak_lo"])
        m.set(-5, 2, 8, PAL["oak_lo"])

    # Arms (z = 6..10)
    arm_col = PAL["shirt_w"] if kind != "grandma" else PAL["card_a"]
    for sx in (-4, 4):
        m.box(sx, sx, -1, 1, 8, 10, arm_col)
        m.box(sx, sx, 0, 1, 6, 7, PAL["skin_a"])

    # Big cute chibi head (z = 11..17)
    for z in range(11, 18):
        for y in range(-3, 5):
            for x in range(-4, 5):
                if abs(x) == 4 and (y <= -3 or y >= 4):
                    continue
                if z == 17 and (abs(x) >= 3 or y <= -2 or y >= 3):
                    continue
                c = PAL["skin_hi"] if z >= 16 else (PAL["skin_a"] if z >= 12 else PAL["skin_lo"])
                m.set(x, y, z, c)
    # Eyes & rosy cheeks on front face (y = +4)
    m.set(-2, 4, 14, PAL["outline"])
    m.set(2, 4, 14, PAL["outline"])
    if kind != "grandma":
        m.set(-2, 4, 13, PAL["outline"])
        m.set(2, 4, 13, PAL["outline"])
    m.set(-3, 4, 12, PAL["cheek"])
    m.set(3, 4, 12, PAL["cheek"])

    # Hair & Hats (z = 11..21)
    if kind == "girl":
        for z in range(10, 18):
            for y in range(-4, 4):
                for x in range(-5, 6):
                    if abs(x) == 5 and abs(y) >= 3:
                        continue
                    if y <= 0 or (abs(x) >= 4 and y <= 2) or (z >= 16 and y <= 4):
                        m.set(x, y, z, PAL["hair_brn_hi"] if z >= 16 else PAL["hair_brn"])
        for z in range(17, 21):
            rad = 5.0 if z == 18 else (4.4 if z == 19 else (3.8 if z == 17 else 2.2))
            for y in range(-5, 5):
                for x in range(-5, 6):
                    if math.hypot(x - 0.5, y) <= rad:
                        c = PAL["beret_hi"] if z >= 19 else (PAL["beret_a"] if z == 18 else PAL["beret_lo"])
                        m.set(x, y, z, c)
        m.set(1, 0, 21, PAL["beret_lo"])
    elif kind == "boy":
        for z in range(12, 17):
            for y in range(-4, 2):
                for x in range(-4, 5):
                    if y <= -1 or abs(x) == 4:
                        if abs(x) == 4 and abs(y) == 4:
                            continue
                        m.set(x, y, z, PAL["hair_brn"])
        m.box(-3, 3, 4, 4, 16, 16, PAL["hair_brn"])
        for z in range(16, 21):
            rad = 4.6 if z <= 18 else (3.8 if z == 19 else 2.2)
            for y in range(-4, 5):
                for x in range(-4, 5):
                    if math.hypot(x, y) <= rad:
                        m.set(x, y, z, PAL["blue_hi"] if z >= 19 else PAL["blue_a"])
        m.box(-3, 3, 4, 7, 16, 17, lambda x, y, z: PAL["blue_lo"] if y == 7 else PAL["blue_a"])
    else:
        for z in range(12, 18):
            for y in range(-4, 3):
                for x in range(-4, 5):
                    if y <= -1 or abs(x) == 4 or z >= 16:
                        if abs(x) == 4 and abs(y) == 4:
                            continue
                        m.set(x, y, z, PAL["hair_gry"] if z >= 16 else PAL["hair_gry_lo"])
        for z in range(18, 22):
            for y in range(-5, 1):
                for x in range(-3, 4):
                    if math.hypot(x, (y + 2.5) * 1.1, (z - 19.5) * 1.1) <= 2.6:
                        m.set(x, y, z, PAL["hair_gry"] if z >= 20 else PAL["hair_gry_lo"])

    return m


def build_coin_stack():
    W, D, H = 10, 10, 5
    m = VoxelModel(W, D, H, ox=-5, oy=-5)
    for z in range(0, 3):
        for y in range(-3, 4):
            for x in range(-3, 4):
                r = math.hypot(x, y)
                if r <= 2.6:
                    c = PAL["gold_hi"] if (z == 2 and r < 1.7) else (PAL["gold_a"] if z >= 1 else PAL["gold_lo"])
                    m.set(x, y, z, c)
    return m


def build_fire_frame(phase):
    W, D, H = 14, 14, 14
    m = VoxelModel(W, D, H, ox=-7, oy=-7)
    m.box(-3, 3, -4, 4, 0, 2, lambda x, y, z: PAL["log_hi"] if (x + y) % 2 == 0 else PAL["log_wood"])
    tips = [
        [(-1, -2, 10), (0, 1, 12), (1, -1, 8)],
        [(0, -1, 12), (-1, 2, 9), (1, 0, 10)],
        [(1, -2, 11), (0, 0, 10), (-1, 1, 11)],
    ][phase % 3]
    for z in range(2, 13):
        for y in range(-4, 5):
            for x in range(-3, 4):
                for tx, ty, th in tips:
                    if z > th:
                        continue
                    r = math.hypot(x - tx, y - ty)
                    rad = max(0.5, (1.0 - (z - 2) / max(1.0, th - 1.5)) * 2.6)
                    if r <= rad:
                        c = PAL["fire_yel"] if (z <= 5 and r < 1.2) else (PAL["fire_org"] if z <= th - 2 else PAL["fire_red"])
                        m.set(x, y, z, c)
    return m


def build_deco_flowers():
    W, D, H = 14, 14, 15
    m = VoxelModel(W, D, H, ox=-7, oy=-7)
    for z in range(0, 6):
        rad = 2.6 + z * 0.25
        for y in range(-5, 6):
            for x in range(-5, 6):
                if math.hypot(x, y) <= rad:
                    m.set(x, y, z, PAL["brick_hi"] if z == 5 else PAL["brick_b"])
    for z in range(6, 10):
        for y in range(-4, 5):
            for x in range(-4, 5):
                if math.hypot(x, y) <= 3.8 - (z - 6) * 0.5:
                    m.set(x, y, z, PAL["leaf_hi"] if (x + y + z) % 2 == 0 else PAL["leaf_a"])
    for fx, fy, fz, fc in [(-2, -1, 11, PAL["flw_red"]), (2, 1, 12, PAL["flw_yel"]), (0, -2, 13, PAL["flw_pnk"]), (-1, 2, 11, PAL["flw_blu"]), (1, 0, 14, PAL["flw_red"])]:
        m.box(fx - 1, fx + 1, fy - 1, fy + 1, fz - 1, fz, fc)
    return m


def build_deco_sign():
    W, D, H = 14, 14, 24
    m = VoxelModel(W, D, H, ox=-7, oy=-7)
    m.box(-1, 1, -1, 1, 0, 22, PAL["oak_b"])
    m.box(-1, 5, -1, 1, 20, 21, PAL["oak_hi"])
    for z in range(11, 19):
        for x in range(1, 7):
            m.set(x, 0, z, PAL["board_a"])
            if 13 <= z <= 16 and 2 <= x <= 5:
                m.set(x, 1, z, PAL["crust_b"])
                m.set(x, -1, z, PAL["crust_b"])
    return m


def build_deco_lantern():
    W, D, H = 12, 12, 23
    m = VoxelModel(W, D, H, ox=-6, oy=-6)
    m.box(-1, 1, -1, 1, 0, 14, PAL["oak_lo"])
    m.box(-2, 2, -2, 2, 14, 15, PAL["gold_lo"])
    m.box(-2, 2, -2, 2, 16, 20, lambda x, y, z: PAL["gold_lo"] if (abs(x) == 2 and abs(y) == 2) else PAL["fire_yel"])
    m.box(-3, 3, -3, 3, 21, 22, PAL["oak_lo"])
    m.set(0, 0, 22, PAL["gold_a"])
    return m


# ---------------------------------------------------------------------------
# Atlas Packer & Crisp Pixel-Art Preview (with 1px outline pass!)
# ---------------------------------------------------------------------------
def pack_slices_to_png(slices, sw, sh, cols, out_path):
    count = len(slices)
    rows = math.ceil(count / cols)
    aw = cols * sw
    ah = rows * sh
    atlas = bytearray(aw * ah * 4)
    for i, sbuf in enumerate(slices):
        cx = (i % cols) * sw
        cy = (i // cols) * sh
        for y in range(sh):
            dst = ((cy + y) * aw + cx) * 4
            src = y * sw * 4
            atlas[dst : dst + sw * 4] = sbuf[src : src + sw * 4]
    png_bytes = write_png(out_path, aw, ah, atlas)
    return png_bytes, aw, ah, cols, rows


def render_preview(shop_slices, sw, sd, sh, props_dict, out_path):
    """Render at true 1x sprite-stacking pixel resolution (with 1px dark-brown outline), then 2x nearest scale!"""
    VW, VH = 300, 220
    # Transparent sprite layer first so we can apply crisp 1px silhouette outline!
    fg = bytearray(VW * VH * 4)

    def blit_stack(slices, w, d, h, cx, cy, angle_rad, tilt=0.52, z_step=1.0):
        ca = math.cos(angle_rad)
        sa = math.sin(angle_rad)
        hw = w * 0.5
        hd = d * 0.5
        rad = int(math.hypot(hw, hd)) + 2
        rad_y = int(rad * tilt) + 2
        for z, sbuf in enumerate(slices):
            # Solid 1px stacking (no gaps!)
            zy = round(cy - z * z_step)
            y_min = max(0, int(zy - rad_y))
            y_max = min(VH - 1, int(zy + rad_y))
            x_min = max(0, int(cx - rad))
            x_max = min(VW - 1, int(cx + rad))
            for py in range(y_min, y_max + 1):
                dy = (py - zy) / tilt
                for px in range(x_min, x_max + 1):
                    dx = px - cx
                    ux = int(math.floor(dx * ca + dy * sa + hw))
                    uy = int(math.floor(-dx * sa + dy * ca + hd))
                    if 0 <= ux < w and 0 <= uy < d:
                        sp = (uy * w + ux) * 4
                        if sbuf[sp + 3] > 128:
                            dp = (py * VW + px) * 4
                            fg[dp] = sbuf[sp]
                            fg[dp + 1] = sbuf[sp + 1]
                            fg[dp + 2] = sbuf[sp + 2]
                            fg[dp + 3] = 255

    # Front 3/4 and Back 3/4
    blit_stack(shop_slices, sw, sd, sh, 78, 102, math.radians(45), tilt=0.52, z_step=1.0)
    blit_stack(shop_slices, sw, sd, sh, 222, 102, math.radians(225), tilt=0.52, z_step=1.0)

    # Bottom lineup of breads + customers
    lineup = [
        "dough_raw", "melon_baked", "croissant_baked", "heart_baked",
        "cinnamon_baked", "baguette_baked", "melon_burnt", "jumbo_baked",
        "cust_girl_0", "cust_boy_0", "cust_grandma_0",
    ]
    for idx, key in enumerate(lineup):
        info = props_dict[key]
        px = 26 + (idx % 6) * 48
        py = 162 if idx < 6 else 206
        blit_stack(info["slices"], info["w"], info["d"], info["h"], px, py, math.radians(38), tilt=0.55, z_step=1.0)

    # Composite onto cream background with crisp 1px warm-brown silhouette outline!
    bg = hx("#FBF0D9")
    ol = PAL["outline"]
    PW, PH = VW * 2, VH * 2
    out = bytearray(PW * PH * 4)
    for y in range(VH):
        for x in range(VW):
            p = (y * VW + x) * 4
            if fg[p + 3] > 128:
                r, g, b = fg[p], fg[p + 1], fg[p + 2]
            else:
                # 4-neighbor outline check
                edge = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < VW and 0 <= ny < VH and fg[(ny * VW + nx) * 4 + 3] > 128:
                        edge = True
                        break
                r, g, b = ol if edge else bg
            for sy in (0, 1):
                for sx in (0, 1):
                    dp = ((y * 2 + sy) * PW + (x * 2 + sx)) * 4
                    out[dp], out[dp + 1], out[dp + 2], out[dp + 3] = r, g, b, 255

    write_png(out_path, PW, PH, out)


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    print("Building bakery shop diorama slices v2 (128x128x68)...")
    shop = build_bakery_shop()
    shop_slices = shop.bake_slices_rgba(ao_strength=0.15, top_boost=1.08)
    shop_png, saw, sah, scols, srows = pack_slices_to_png(
        shop_slices, shop.w, shop.d, cols=17,
        out_path=os.path.join(ASSETS_DIR, "bakery_slices.png")
    )
    print(f"  -> bakery_slices.png: {saw}x{sah}, {len(shop_png)//1024} KB")

    print("Building breads, toppings, customers, and props slices v2...")
    models = {}
    models["dough_raw"] = build_dough_or_bread("dough", "raw")
    for sh in ("melon", "croissant", "heart", "cinnamon", "baguette", "jumbo"):
        for st in ("raw", "baked", "burnt"):
            models[f"{sh}_{st}"] = build_dough_or_bread(sh, st)
    for tk in ("strawberry", "choco", "butter"):
        models[f"top_{tk}"] = build_topping(tk)
    for ck in ("girl", "boy", "grandma"):
        for step in (0, 1):
            models[f"cust_{ck}_{step}"] = build_customer(ck, step)
    models["coin"] = build_coin_stack()
    for pf in range(3):
        models[f"fire_{pf}"] = build_fire_frame(pf)
    models["deco_flowers"] = build_deco_flowers()
    models["deco_sign"] = build_deco_sign()
    models["deco_lantern"] = build_deco_lantern()

    props_meta = {}
    props_baked = {}
    max_w = 0
    total_h = 0
    for key, mdl in models.items():
        if key.startswith("fire_"):
            rim = None
        elif key.endswith("_raw"):
            rim = hx("#7A6752")
        elif key.endswith("_burnt"):
            rim = hx("#181514")
        elif key.startswith("cust_") or key.startswith("deco_") or key == "coin":
            rim = PAL["outline"]
        else:
            rim = hx("#5C270A")
        sl = mdl.bake_slices_rgba(ao_strength=0.11, top_boost=1.09, rim_color=rim)
        props_baked[key] = {"slices": sl, "w": mdl.w, "d": mdl.d, "h": mdl.h}
        row_w = mdl.w * mdl.h
        if row_w > max_w:
            max_w = row_w
        total_h += mdl.d

    props_atlas = bytearray(max_w * total_h * 4)
    cy = 0
    for key, info in props_baked.items():
        w, d, h = info["w"], info["d"], info["h"]
        props_meta[key] = {"w": w, "d": d, "h": h, "y": cy}
        for i, sbuf in enumerate(info["slices"]):
            cx = i * w
            for y in range(d):
                dst = ((cy + y) * max_w + cx) * 4
                src = y * w * 4
                props_atlas[dst : dst + w * 4] = sbuf[src : src + w * 4]
        cy += d

    props_png = write_png(os.path.join(ASSETS_DIR, "props_slices.png"), max_w, total_h, props_atlas)
    print(f"  -> props_slices.png: {max_w}x{total_h}, {len(props_png)//1024} KB")

    js_meta = {
        "shop": {
            "w": shop.w, "d": shop.d, "h": shop.h,
            "ox": shop.ox, "oy": shop.oy,
            "cols": scols, "rows": srows,
            "dataUrl": "data:image/png;base64," + base64.b64encode(shop_png).decode("ascii"),
        },
        "props": {
            "w": max_w, "h": total_h,
            "items": props_meta,
            "dataUrl": "data:image/png;base64," + base64.b64encode(props_png).decode("ascii"),
        },
    }
    js_path = os.path.join(ASSETS_DIR, "sprites_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by tools/build_slices.py — faithful sprite-stacking slice atlases\n")
        f.write("window.BAKERY_SPRITES = ")
        json.dump(js_meta, f, separators=(",", ":"))
        f.write(";\n")
    print(f"  -> sprites_data.js: {os.path.getsize(js_path)//1024} KB")

    print("Rendering true 1x+outline verification preview...")
    render_preview(shop_slices, shop.w, shop.d, shop.h, props_baked, os.path.join(TOOLS_DIR, "preview_views.png"))
    print("Done!")


if __name__ == "__main__":
    main()
