#!/usr/bin/env python3
"""Generate every raster of the CalculixHub mark from its one definition.

The mark is the lowercase "e" in public/favicon.svg and src/components/brand.ts:
one teal stroke with a round terminal dot. Its path is written once below
(MARK_PATH), checked against both of those files on every run so the three can
never drift, and rasterised with Pillow, so no SVG renderer is required.

Usage:
    python3 scripts/generate-icons.py

Requires Pillow (and numpy, for the link-preview card's gradient). Outputs:

- public/icons/        the PWA and apple-touch icons, in two families:
  - "any" icons: the mark on its paper field, edge to edge. Used by desktop and
    Android launchers and as the iOS apple-touch-icon, which is why they carry
    no transparency -- iOS composites non-opaque touch icons onto black.
  - "maskable" icons: the same mark inset to the safe zone so Android's adaptive
    icon shapes can crop 20% off each edge without clipping it.
- public/favicon.ico   16/32/48 px, for crawlers and browsers that ask for
  /favicon.ico before (or instead of) reading the page's <link rel="icon">.
- public/og-image.png  the 1200x630 card chat apps, social networks and search
  show when the site's link is shared.
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


# Link-preview card. Night-blue ink, as the landing hero is, so the shared link
# looks like the page it opens. Cyan is the mark's colour on night (--lx-cyan).
NIGHT_TOP, NIGHT_BOTTOM = (23, 48, 58), (11, 28, 35)
CYAN = "#86dbec"
ON_NIGHT = "#f4efe3"
ON_NIGHT_MUTED = "#9db8bf"
FONT_DIRS = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/inter", "/Library/Fonts", "/System/Library/Fonts/Supplemental", "/usr/share/fonts/truetype/dejavu"]


def load_font(names: list[str], size: int):
    from PIL import ImageFont

    for directory in FONT_DIRS:
        for name in names:
            candidate = pathlib.Path(directory) / name
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size)


def render_og_card(width: int = 1200, height: int = 630) -> Image.Image:
    import numpy as np
    from PIL import ImageFilter

    ss = 2
    w, h = width * ss, height * ss
    # Vertical night gradient, with a pool of teal light behind the mark.
    ys = np.linspace(0, 1, h)[:, None, None]
    top, bottom = np.array(NIGHT_TOP, dtype=np.float32), np.array(NIGHT_BOTTOM, dtype=np.float32)
    base = top * (1 - ys) + bottom * ys
    base = np.repeat(base, w, axis=1)
    xs = np.linspace(0, w, w)[None, :]
    yy = np.linspace(0, h, h)[:, None]
    cx, cy = w * 0.27, h * 0.5
    glow = np.exp(-(((xs - cx) / (w * 0.30)) ** 2 + ((yy - cy) / (h * 0.55)) ** 2))[:, :, None]
    base = base + glow * np.array([22, 70, 80], dtype=np.float32)
    img = Image.fromarray(np.clip(base, 0, 255).astype("uint8"), "RGB").convert("RGBA")

    # The mark, with a soft halo under it.
    mark_box = (w * 0.075, h * 0.2, w * 0.075 + h * 0.6, h * 0.8)
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_mark(halo, mark_box, CYAN, CYAN)
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(h * 0.02)))
    mark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_mark(mark, mark_box, CYAN, CYAN)
    img.alpha_composite(mark)

    draw = ImageDraw.Draw(img)
    left = w * 0.465
    word_font = load_font(["Inter-SemiBold.otf", "Inter-SemiBold.ttf", "DejaVuSans-Bold.ttf"], 96 * ss)
    light_font = load_font(["Inter-Regular.otf", "Inter-Regular.ttf", "DejaVuSans.ttf"], 96 * ss)
    line_font = load_font(["Inter-Medium.otf", "Inter-Medium.ttf", "DejaVuSans.ttf"], 36 * ss)
    small_font = load_font(["Inter-Medium.otf", "Inter-Medium.ttf", "DejaVuSans.ttf"], 24 * ss)

    word_y = h * 0.30
    draw.text((left, word_y), "calculix", font=word_font, fill=ON_NIGHT)
    calculix_width = draw.textlength("calculix", font=word_font)
    draw.text((left + calculix_width, word_y), "hub", font=light_font, fill=ON_NIGHT)
    draw.text((left, h * 0.54), "Competition math, matched", font=line_font, fill=ON_NIGHT_MUTED)
    draw.text((left, h * 0.54 + 50 * ss), "to your level.", font=line_font, fill=ON_NIGHT_MUTED)
    draw.rounded_rectangle([left, h * 0.80, left + 74 * ss, h * 0.80 + 4 * ss], radius=2 * ss, fill="#f1c071")
    draw.text((left, h * 0.80 + 22 * ss), "AMC  \u00b7  AIME  \u00b7  USAMO  \u00b7  IMO", font=small_font, fill=ON_NIGHT_MUTED)

    return img.convert("RGB").resize((width, height), Image.LANCZOS)


def write_og_image(root: pathlib.Path) -> None:
    path = root / "public" / "og-image.png"
    render_og_card().save(path, "PNG", optimize=True)
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
