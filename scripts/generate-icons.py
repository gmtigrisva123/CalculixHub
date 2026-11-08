#!/usr/bin/env python3
"""Generate every raster of the CalculixHub mark from its one definition.

The mark is the lowercase "e" in public/favicon.svg and src/components/brand.ts:
one teal stroke with a round terminal dot. Its path is written once below
(MARK_PATH), checked against both of those files on every run so the three can
never drift, and rasterised with Pillow, so no SVG renderer is required.

Usage:
    python3 scripts/generate-icons.py

Requires Pillow, and numpy for the link-preview card. Outputs:

- public/icons/        the PWA and apple-touch icons, in two families:
  - "any" icons: the mark on its paper field, edge to edge. Used by desktop and
    Android launchers and as the iOS apple-touch-icon, which is why they carry
    no transparency -- iOS composites non-opaque touch icons onto black.
  - "maskable" icons: the same mark inset to the safe zone so Android's adaptive
    icon shapes can crop 20% off each edge without clipping it.
- public/favicon.ico   16/32/48 px, for crawlers and browsers that ask for
  /favicon.ico before (or instead of) reading the page's <link rel="icon">.
- public/og-image.png  the 1200x630 card chat apps, social networks and search
  show when the site's link is shared: the landing hero in miniature, with the
  figures read from archiveFigures.ts. Crawlers cache it by URL, so bump the
  ?v= in index.html when it changes.
- ios/ assets          the app icon and launch image, when ios/ exists.
"""

from __future__ import annotations

import pathlib
import re
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - dependency guidance only
    sys.exit("Pillow is required: python3 -m pip install Pillow")

# Brand tokens. TEAL is oklch(48% .059 227), as sRGB; it is written as a hex in
# favicon.svg too, because crawlers and some browsers cannot read oklch().
PAPER = "#f7f9f5"
TEAL = "#366478"

# The mark, in a 40x40 viewBox. Keep identical to src/components/brand.ts and
# public/favicon.svg -- check_sources() below fails loudly if they differ.
MARK_PATH = "M30 9C11 2 2 27 18 32c7 3 15-3 15-10M7 23 32 12"
STROKE_WIDTH = 2.5
DOT_CENTRE, DOT_RADIUS = (31.0, 12.0), 3.0


def parse_path(d: str):
    """Turn the mark's path into polylines' control data: a list of cubic
    segments and straight lines. Only the commands the mark uses are handled:
    M/m, C/c and a bare coordinate pair after M (an implicit line).
    """
    tokens = re.findall(r"[MmCcLl]|-?\d*\.?\d+", d)
    i = 0
    cmd = None
    pos = (0.0, 0.0)
    start = pos
    curves, lines = [], []

    def num():
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        if re.fullmatch(r"[MmCcLl]", tokens[i]):
            cmd = tokens[i]
            i += 1
        if cmd in "Mm":
            x, y = num(), num()
            pos = (x, y) if cmd == "M" else (pos[0] + x, pos[1] + y)
            start = pos
            cmd = "L" if cmd == "M" else "l"  # extra pairs after a move are lines
        elif cmd in "Ll":
            x, y = num(), num()
            end = (x, y) if cmd == "L" else (pos[0] + x, pos[1] + y)
            lines.append((pos, end))
            pos = end
        elif cmd in "Cc":
            pts = [(num(), num()) for _ in range(3)]
            if cmd == "c":
                pts = [(pos[0] + x, pos[1] + y) for x, y in pts]
            curves.append((pos, pts[0], pts[1], pts[2]))
            pos = pts[2]
        else:  # pragma: no cover - guards against a path using a command not handled above
            raise ValueError(f"unsupported path command {cmd!r}")
    return curves, lines


CURVES, BAR_LINES = parse_path(MARK_PATH)
# The mark is one stroke plus a straight crossbar.
BAR = BAR_LINES[-1]


def check_sources(root: pathlib.Path) -> None:
    """Fail if the mark is not the same in the SVG, the TypeScript and this script."""
    svg = (root / "public" / "favicon.svg").read_text()
    ts = (root / "src" / "components" / "brand.ts").read_text()
    for name, text in (("public/favicon.svg", svg), ("src/components/brand.ts", ts)):
        if MARK_PATH not in text:
            sys.exit(f"{name} does not draw the mark in MARK_PATH; update them together.")
    if "cx=\"31\" cy=\"12\" r=\"3\"" not in svg:
        sys.exit("public/favicon.svg's dot does not match DOT_CENTRE / DOT_RADIUS.")


SUPERSAMPLE = 4

# (filename, pixel size, maskable) -- 180 is the iOS apple-touch-icon size, 192
# and 512 are the Android/Chrome install minimums, 1024 is the App Store asset.
TARGETS = [
    ("icon-180.png", 180, False),
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-1024.png", 1024, False),
    ("icon-maskable-192.png", 192, True),
    ("icon-maskable-512.png", 512, True),
]


def bezier(p0, c1, c2, p1, steps: int = 80):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        pts.append(
            (
                u**3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t**3 * p1[0],
                u**3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t**3 * p1[1],
            )
        )
    return pts


def mark_polylines():
    return [bezier(*c) for c in CURVES] + [[BAR[0], BAR[1]]]


def mark_bounds():
    xs, ys = [], []
    for line in mark_polylines():
        for x, y in line:
            xs.append(x)
            ys.append(y)
    half = STROKE_WIDTH / 2
    xs += [DOT_CENTRE[0] - DOT_RADIUS, DOT_CENTRE[0] + DOT_RADIUS]
    ys += [DOT_CENTRE[1] - DOT_RADIUS, DOT_CENTRE[1] + DOT_RADIUS]
    return min(xs) - half, min(ys) - half, max(xs) + half, max(ys) + half


def render(size: int, maskable: bool) -> Image.Image:
    canvas = size * SUPERSAMPLE
    img = Image.new("RGB", (canvas, canvas), PAPER)
    draw = ImageDraw.Draw(img)

    # Fit the mark's bounding box into a fraction of the canvas and centre it.
    # A maskable icon must survive a 20% crop on every edge, so it sits smaller.
    x0, y0, x1, y1 = mark_bounds()
    extent = max(x1 - x0, y1 - y0)
    scale = canvas * (0.50 if maskable else 0.66) / extent
    ox = (canvas - (x1 - x0) * scale) / 2 - x0 * scale
    oy = (canvas - (y1 - y0) * scale) / 2 - y0 * scale

    def tx(pt):
        return (pt[0] * scale + ox, pt[1] * scale + oy)

    r = STROKE_WIDTH / 2 * scale
    for line in mark_polylines():
        pts = [tx(p) for p in line]
        draw.line(pts, fill=TEAL, width=round(r * 2))
        # Round caps and joins.
        for cx, cy in (pts[0], pts[-1]):
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL)
        for cx, cy in pts[1:-1]:
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL)

    dx, dy = tx(DOT_CENTRE)
    dr = DOT_RADIUS * scale
    draw.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=TEAL)

    return img.resize((size, size), Image.LANCZOS)


def render_splash(size: int = 2732) -> Image.Image:
    """iOS launch image: the mark centred on the paper field.

    Square at 2732px because iOS crops the same asset to every device aspect
    ratio; anything off-centre or near an edge gets cut on some screen. The mark
    is kept small for that reason.
    """
    img = Image.new("RGB", (size, size), PAPER)
    mark = render(round(size * 0.16), maskable=False)
    offset = (size - mark.width) // 2
    img.paste(mark, (offset, offset))
    return img


def write_ios_assets(root: pathlib.Path) -> None:
    """Replace Capacitor's placeholder icon and splash, when the platform exists.

    Skipped silently if ios/ has not been generated yet, so the script stays
    usable for web-only checkouts.
    """
    assets = root / "ios" / "App" / "App" / "Assets.xcassets"
    if not assets.is_dir():
        print("  (ios/ not present — skipping native assets)")
        return

    icon_path = assets / "AppIcon.appiconset" / "AppIcon-512@2x.png"
    if icon_path.parent.is_dir():
        # The iOS app icon must be opaque and must not be pre-rounded: iOS
        # applies its own corner mask, so a transparent or pre-masked icon
        # shows dark corners on the home screen.
        render(1024, maskable=False).save(icon_path, "PNG", optimize=True)
        print(f"  {icon_path.relative_to(root)}  1024x1024")

    splash_dir = assets / "Splash.imageset"
    if splash_dir.is_dir():
        splash = render_splash()
        # Capacitor references the same square asset at 1x, 2x and 3x.
        for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
            splash.save(splash_dir / name, "PNG", optimize=True)
        print(f"  {splash_dir.relative_to(root)}/splash-2732x2732*.png  2732x2732")


def draw_mark(img: Image.Image, box: tuple[float, float, float, float], fill: str, ink: str, scale_to: float | None = None) -> None:
    """Draw the mark, fitted and centred in `box` (x0, y0, x1, y1), onto `img`."""
    draw = ImageDraw.Draw(img)
    x0, y0, x1, y1 = mark_bounds()
    extent = max(x1 - x0, y1 - y0)
    bx0, by0, bx1, by1 = box
    scale = (scale_to if scale_to else min(bx1 - bx0, by1 - by0)) / extent
    ox = bx0 + ((bx1 - bx0) - (x1 - x0) * scale) / 2 - x0 * scale
    oy = by0 + ((by1 - by0) - (y1 - y0) * scale) / 2 - y0 * scale
    r = STROKE_WIDTH / 2 * scale

    def tx(pt):
        return (pt[0] * scale + ox, pt[1] * scale + oy)

    for line in mark_polylines():
        pts = [tx(p) for p in line]
        draw.line(pts, fill=ink, width=round(r * 2))
        for cx, cy in pts:
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
    dx, dy = tx(DOT_CENTRE)
    dr = DOT_RADIUS * scale
    draw.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=ink)


def render_tile(size: int) -> Image.Image:
    """The mark on a rounded paper tile, transparent outside it: the favicon.ico face."""
    canvas = size * SUPERSAMPLE
    tile = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    mask = Image.new("L", (canvas, canvas), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, canvas - 1, canvas - 1], radius=canvas * 0.22, fill=255)
    tile.paste(Image.new("RGBA", (canvas, canvas), PAPER), (0, 0), mask)
    pad = canvas * 0.12
    draw_mark(tile, (pad, pad, canvas - pad, canvas - pad), PAPER, TEAL)
    return tile.resize((size, size), Image.LANCZOS)


def write_favicon_ico(root: pathlib.Path) -> None:
    path = root / "public" / "favicon.ico"
    render_tile(256).save(path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {path.relative_to(root)}  16, 32, 48")


# Link-preview card: the landing hero, in miniature. The same night-blue stage,
# the same Mobius strip with its one warm edge, the same headline with its
# italic word underlined in brass -- so a shared link looks like the page it
# opens. Colours are the hero's (--lx-pf-cool / -warm / -edge, --lx-cyan).
CYAN = "#86dbec"
BRASS = "#f1c071"
ON_NIGHT = "#f4efe3"
ON_NIGHT_BODY = "#b4cbd0"
ON_NIGHT_MUTED = "#86a3ab"
STRIP_COOL, STRIP_WARM, STRIP_EDGE = (0x6F, 0xCD, 0xE4), (0xDC, 0xEF, 0xE9), (0xFF, 0xC5, 0x6E)
FONT_DIRS = [
    "/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/inter", "/usr/share/fonts/truetype/crosextra",
    "/usr/share/fonts/truetype/freefont", "/usr/share/fonts/truetype/liberation", "/usr/share/fonts/truetype/dejavu",
    "/Library/Fonts", "/System/Library/Fonts/Supplemental", "/System/Library/Fonts",
]
# Newsreader is the page's italic; where it is not installed, the closest serif italic that is.
SERIF_ITALIC = ["Newsreader-Italic.ttf", "Newsreader_Italic.ttf", "Caladea-Italic.ttf", "Georgia Italic.ttf", "LiberationSerif-Italic.ttf", "DejaVuSerif-Italic.ttf"]
SANS_DISPLAY = {
    600: ["InterDisplay-SemiBold.otf", "Inter-SemiBold.otf", "Inter-SemiBold.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"],
    500: ["InterDisplay-Medium.otf", "Inter-Medium.otf", "Inter-Medium.ttf", "Arial.ttf", "DejaVuSans.ttf"],
}
SANS_TEXT = {
    400: ["Inter-Regular.otf", "Inter-Regular.ttf", "Arial.ttf", "DejaVuSans.ttf"],
    500: ["Inter-Medium.otf", "Inter-Medium.ttf", "Arial.ttf", "DejaVuSans.ttf"],
    600: ["Inter-SemiBold.otf", "Inter-SemiBold.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"],
}


def load_font(names: list[str], size: int):
    from PIL import ImageFont

    for directory in FONT_DIRS:
        for name in names:
            candidate = pathlib.Path(directory) / name
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size)


def archive_figures(root: pathlib.Path) -> dict[str, int]:
    """The landing page's own figures, read from the file that holds them, so the card cannot disagree with the page."""
    text = (root / "src" / "components" / "landing" / "archiveFigures.ts").read_text()
    figures = {}
    for key in ("problems", "papers", "firstYear", "lastYear"):
        match = re.search(rf"^\s{{2}}{key}:\s*(\d+),", text, re.M)
        if not match:
            sys.exit(f"archiveFigures.ts no longer states {key}; update scripts/generate-icons.py.")
        figures[key] = int(match.group(1))
    return figures


def _blur(arr, sigma: float):
    """Gaussian blur of an HxWxC float array, by separable shifts; wide kernels run on a shrunken copy."""
    import numpy as np

    if sigma > 5:
        factor = int(sigma // 2.5)
        h, w, c = arr.shape
        h2, w2 = h // factor, w // factor
        small = arr[: h2 * factor, : w2 * factor].reshape(h2, factor, w2, factor, c).mean(axis=(1, 3))
        small = _blur(small, sigma / factor)
        out = np.empty_like(arr)
        for channel in range(c):
            im = Image.fromarray(small[:, :, channel].astype("float32"), mode="F")
            out[:, :, channel] = np.asarray(im.resize((w, h), Image.BICUBIC))
        return out
    radius = max(1, int(sigma * 3))
    xs = np.arange(-radius, radius + 1)
    kernel = np.exp(-(xs**2) / (2 * sigma**2))
    kernel /= kernel.sum()
    for axis in (1, 0):
        out = np.zeros_like(arr)
        for offset, weight in zip(xs, kernel):
            out += weight * np.roll(arr, int(offset), axis=axis)
        arr = out
    return arr


def mobius_light(width: int, height: int, centre: tuple[float, float], reach: float):
    """The hero's strip, lit by its lamp, as an additive glow image (HxWx3, 0..~1).

    Same maths as the hero's vertex shader: rails of points on the strip, each
    shaded by the way its surface faces the lamp and the eye, the near arc
    brighter than the far, the one edge kept warm all the way round.
    """
    import numpy as np

    rng = np.random.default_rng(5)
    radius, half = 1.75, 0.62
    rails, per = 36, 1700
    s0 = np.linspace(-half, half, rails)[:, None] * np.ones((1, per))
    k = np.arange(per)[None, :] * np.ones((rails, 1))
    u = (k + rng.uniform(-0.12, 0.12, (rails, per))) / per * 2 * np.pi
    seed = rng.uniform(0.02, 1.0, (rails, per))
    s = s0 + 0.014 * np.sin(u * 2 + s0 * 9) + 0.006 * np.sin(u * 5 + seed * 40)
    h = u / 2
    reach_ = radius + s * np.cos(h)
    pos = np.stack([reach_ * np.cos(u), s * np.sin(h), reach_ * np.sin(u)], -1).reshape(-1, 3)
    along = np.stack([-reach_ * np.sin(u) - 0.5 * s * np.sin(h) * np.cos(u), 0.5 * s * np.cos(h), reach_ * np.cos(u) - 0.5 * s * np.sin(h) * np.sin(u)], -1)
    across = np.stack([np.cos(h) * np.cos(u), np.sin(h), np.cos(h) * np.sin(u)], -1)
    normal = np.cross(along, across).reshape(-1, 3)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    tone = (0.5 + 0.5 * np.cos(u)).reshape(-1)
    edge = np.clip((np.abs(s0.reshape(-1)) - half * 0.8) / (half * 0.2), 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    seed = seed.reshape(-1)

    def rot(axis, a):
        c, s_ = np.cos(a), np.sin(a)
        if axis == "x":
            return np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]])
        if axis == "y":
            return np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
        return np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])

    # The hero tips the strip towards the viewer (0.5) and turns it slowly; here, caught mid-turn.
    matrix = rot("x", 0.52) @ rot("y", 2.55) @ rot("z", 0.18)
    pos, normal = pos @ matrix.T, normal @ matrix.T
    distance = 9.5
    depth = distance - pos[:, 2]
    px = centre[0] + reach * (distance / 2.37) * pos[:, 0] / depth
    py = centre[1] - reach * (distance / 2.37) * pos[:, 1] / depth

    to_eye = np.stack([-pos[:, 0], -pos[:, 1], distance - pos[:, 2]], -1)
    to_eye /= np.linalg.norm(to_eye, axis=1, keepdims=True)
    flip = np.sign(np.einsum("ij,ij->i", normal, to_eye))
    normal = normal * flip[:, None]
    lamp = np.array([-0.46, 0.62, 0.64])
    lamp /= np.linalg.norm(lamp)
    lit = np.clip(normal @ lamp, 0, 1)
    rim = (1 - np.clip(np.einsum("ij,ij->i", normal, to_eye), 0, 1)) ** 2.4
    shade = 0.58 + 0.62 * lit + 0.28 * rim
    shade = np.where(edge > 0, np.maximum(shade, 1.0) * edge + shade * (1 - edge), shade)
    near = np.clip(0.5 + (pos[:, 2] / 5.0), 0, 1)
    alpha = 0.5 * (1 - 0.6 * rim) * (0.62 + 0.5 * near) * (0.74 + 0.26 * rng.uniform(0, 1, seed.shape))

    cool, warm, warm_edge = (np.array(c, dtype=np.float32) / 255 for c in (STRIP_COOL, STRIP_WARM, STRIP_EDGE))
    base = cool[None, :] * (1 - tone[:, None]) + warm[None, :] * tone[:, None]
    colour = base * (1 - 0.9 * edge[:, None]) + warm_edge[None, :] * 0.9 * edge[:, None]
    colour = colour + (lit * lit * 0.55 * (1 - edge))[:, None] * (0.5 * (colour + warm_edge[None, :]) + 0.12 - colour)
    spark = (seed > 0.986).astype(np.float32)
    weight = (alpha * shade * (1 + 0.5 * edge))[:, None] * colour * (1 + 2.2 * spark[:, None])

    buffer = np.zeros((height, width, 3), dtype=np.float32)
    ix, iy = np.clip(px.astype(int), 0, width - 1), np.clip(py.astype(int), 0, height - 1)
    np.add.at(buffer, (iy, ix), weight)
    # A tight core, a soft halo, and a wide bloom: the shader's sprite, summed over every point.
    return buffer, _blur(buffer, 1.0), _blur(buffer, 5.0), _blur(buffer, 20.0), edge, (ix, iy, shade)


def draw_tracked(draw, xy, text, font, fill, tracking=0.0):
    """Text with letter-spacing, keeping the font's kerning (each glyph placed by its prefix's width)."""
    x, y = xy
    for index, char in enumerate(text):
        draw.text((x + draw.textlength(text[:index], font=font) + tracking * index, y), char, font=font, fill=fill)
    return x + draw.textlength(text, font=font) + tracking * len(text)


def render_og_card(root: pathlib.Path, width: int = 1200, height: int = 630) -> Image.Image:
    import numpy as np

    ss = 2
    w, h = width * ss, height * ss
    rng = np.random.default_rng(3)

    # --- The stage -------------------------------------------------------------
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    top, bottom = np.array((18, 44, 55), np.float32), np.array((9, 24, 32), np.float32)
    stage = top * (1 - ys) + bottom * ys + 0 * xs

    def pool(cx, cy, rx, ry, rgb):
        return np.exp(-(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)) * np.array(rgb, np.float32)

    stage = stage + pool(0.72, 0.46, 0.34, 0.62, (20, 62, 70)) + pool(0.92, 0.10, 0.26, 0.4, (10, 22, 44)) + pool(0.75, 1.02, 0.28, 0.22, (46, 34, 14))
    # The words sit on the darker side, as in the hero.
    stage = stage * (0.80 + 0.20 * np.clip(xs / 0.55, 0, 1))

    # --- The strip ---------------------------------------------------------------
    raw, core, halo, bloom, edge, _ = mobius_light(w, h, centre=(w * 0.765, h * 0.455), reach=w * 0.185)
    light = core * 9.0 + halo * 2.0 + bloom * 0.9
    glow = (1 - np.exp(-light * 1.25)) * 255
    # Stars, as the hero has: a little loose dust around the form.
    dust = np.zeros((h, w, 3), np.float32)
    n = 900
    dx, dy = rng.integers(0, w, n), rng.integers(0, h, n)
    np.add.at(dust, (dy, dx), rng.uniform(0.2, 0.7, (n, 1)) * np.array([0.5, 0.8, 0.9], np.float32))
    glow = glow + _blur(dust, 1.6) * 255 * 2.2

    canvas = 255 - (255 - np.clip(stage, 0, 255)) * (255 - np.clip(glow, 0, 255)) / 255  # screen blend
    img = Image.fromarray(np.clip(canvas, 0, 255).astype("uint8"), "RGB").convert("RGBA")
    draw = ImageDraw.Draw(img)

    # --- The words -----------------------------------------------------------------
    left = 76 * ss
    # Brand lockup: the e, and the name.
    draw_mark(img, (left - 4 * ss, 52 * ss, left + 44 * ss, 100 * ss), CYAN, CYAN)
    name_font = load_font(SANS_DISPLAY[600], 33 * ss)
    light_font = load_font(SANS_TEXT[400], 33 * ss)
    nx = left + 62 * ss
    end = draw_tracked(draw, (nx, 56 * ss), "calculix", name_font, ON_NIGHT, -0.6 * ss)
    draw_tracked(draw, (end, 56 * ss), "hub", light_font, ON_NIGHT, -0.6 * ss)

    # The headline, with its one italic word.
    size = 100 * ss
    head = load_font(SANS_DISPLAY[600], size)
    ital = load_font(SERIF_ITALIC, round(size * 1.1))
    track = -4.2 * ss
    line1_y = 142 * ss
    draw_tracked(draw, (left, line1_y), "Stay with", head, ON_NIGHT, track)
    line2_y = line1_y + 92 * ss
    x = draw_tracked(draw, (left, line2_y), "the ", head, ON_NIGHT, track)
    word_x = x + 4 * ss
    # The italic is taller than the sans; sit it on the same baseline.
    base_sans = line2_y + head.getmetrics()[0]
    ital_y = base_sans - ital.getmetrics()[0]
    x_end = draw_tracked(draw, (word_x, ital_y), "question", ital, CYAN, -2.6 * ss)
    draw_tracked(draw, (x_end + 2 * ss, line2_y), ".", head, ON_NIGHT, track)
    # A brass stroke under it, drawn like a pen: slightly rising, slightly bowed.
    uy = base_sans + 20 * ss
    pts = []
    for i in range(61):
        t = i / 60
        xx = word_x + 6 * ss + t * (x_end - word_x - 14 * ss)
        yy = uy + (6 * np.sin(t * np.pi) - 5 * t) * ss
        pts.append((xx, yy))
    thick = round(5.4 * ss)
    draw.line(pts, fill=BRASS, width=thick, joint="curve")
    for cx_, cy_ in (pts[0], pts[-1]):
        draw.ellipse([cx_ - thick / 2, cy_ - thick / 2, cx_ + thick / 2, cy_ + thick / 2], fill=BRASS)

    # The line under it.
    body = load_font(SANS_TEXT[400], 28 * ss)
    draw.text((left, 360 * ss), "Contest math from AMC to IMO,", font=body, fill=ON_NIGHT_BODY)
    draw.text((left, 360 * ss + 40 * ss), "matched to your level.", font=body, fill=ON_NIGHT_BODY)

    # The figures, as the hero's foot states them.
    figures = archive_figures(root)
    rule_y = 486 * ss
    draw.line([(left, rule_y), (w - 76 * ss, rule_y)], fill=(52, 82, 92), width=ss)
    number_font = load_font(SANS_DISPLAY[500], 40 * ss)
    label_font = load_font(SANS_TEXT[500], 13 * ss)
    columns = [
        (f"{figures['problems']:,}", "PAST PROBLEMS"),
        (f"{figures['papers']}", "REAL EXAMS"),
        (f"{figures['firstYear']}–{figures['lastYear']}", "YEARS OF CONTESTS"),
    ]
    cx_ = left
    for number, label in columns:
        draw_tracked(draw, (cx_, rule_y + 22 * ss), number, number_font, ON_NIGHT, -1.0 * ss)
        draw_tracked(draw, (cx_, rule_y + 76 * ss), label, label_font, ON_NIGHT_MUTED, 2.0 * ss)
        cx_ += max(draw.textlength(number, font=number_font), draw.textlength(label, font=label_font) + 2.0 * ss * len(label)) + 52 * ss

    url_font = load_font(SANS_TEXT[500], 19 * ss)
    url = "calculixhub.com"
    draw_tracked(draw, (w - 76 * ss - draw.textlength(url, font=url_font), rule_y + 74 * ss), url, url_font, ON_NIGHT_MUTED, 0.4 * ss)

    return img.convert("RGB").resize((width, height), Image.LANCZOS)


def write_og_image(root: pathlib.Path) -> None:
    path = root / "public" / "og-image.png"
    render_og_card(root).save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(root)}  1200x630")


def main() -> None:
    root = pathlib.Path(__file__).resolve().parent.parent
    check_sources(root)
    out_dir = root / "public" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, size, maskable in TARGETS:
        path = out_dir / name
        render(size, maskable).save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(root)}  {size}x{size}")

    write_favicon_ico(root)
    write_og_image(root)
    write_ios_assets(root)


if __name__ == "__main__":
    main()
