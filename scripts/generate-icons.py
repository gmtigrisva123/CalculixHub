#!/usr/bin/env python3
"""Generate the PWA / iOS icon set from the brand mark in public/favicon.svg.

The mark is the lowercase "e" drawn in favicon.svg: one teal stroke with a round
terminal dot. The path is reproduced below (keep it in sync with the SVG) and
rasterised with Pillow, so no SVG renderer is required.

Usage:
    python3 scripts/generate-icons.py

Requires Pillow. Outputs to public/icons/ in two families:

- "any" icons: the mark on its paper field, edge to edge. Used by desktop and
  Android launchers and as the iOS apple-touch-icon, which is why they carry no
  transparency -- iOS composites non-opaque touch icons onto black.
- "maskable" icons: the same mark inset to the safe zone so Android's adaptive
  icon shapes can crop 20% off each edge without clipping it.
"""

from __future__ import annotations

import pathlib
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - dependency guidance only
    sys.exit("Pillow is required: python3 -m pip install Pillow")

# Brand tokens. TEAL is oklch(48% .059 227) from favicon.svg, as sRGB.
PAPER = "#f7f9f5"
TEAL = "#366478"

# favicon.svg geometry, in its 40x40 viewBox.
STROKE_WIDTH = 2.5
DOT_CENTRE, DOT_RADIUS = (31.0, 12.0), 3.0
# Cubic segments: (p0, c1, c2, p1). The crossbar is a straight line.
CURVES = [
    ((30, 9), (11, 2), (2, 27), (18, 32)),
    ((18, 32), (25, 35), (33, 29), (33, 22)),
]
BAR = ((7, 23), (32, 12))

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


def main() -> None:
    root = pathlib.Path(__file__).resolve().parent.parent
    out_dir = root / "public" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, size, maskable in TARGETS:
        path = out_dir / name
        render(size, maskable).save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(root)}  {size}x{size}")

    write_ios_assets(root)


if __name__ == "__main__":
    main()
