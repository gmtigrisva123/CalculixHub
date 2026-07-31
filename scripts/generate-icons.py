#!/usr/bin/env python3
"""Generate the PWA / iOS icon set from the in-app brand mark.

The mark is the same one used by the favicon in index.html and the sigma tile in
the app shell: a brass capital sigma on an ink field. Rendering it here rather
than checking in opaque binaries means the icons can be regenerated whenever the
brand tokens move.

Usage:
    python3 scripts/generate-icons.py

Requires Pillow and a serif TTF. Georgia is preferred because it is what the
in-app mark specifies (font-family: Georgia, serif); the script falls back
through Times New Roman to Arial Unicode so it still runs on hosts without it.

Outputs to public/icons/. Two families are produced:

- "any" icons: the mark on its ink field, edge to edge. Used by desktop and
  Android launchers and as the iOS apple-touch-icon, which is why they carry no
  transparency -- iOS composites non-opaque touch icons onto black.
- "maskable" icons: the same mark inset to the safe zone so Android's adaptive
  icon shapes (circle, squircle, teardrop) can crop 20% off each edge without
  clipping the glyph.
"""

from __future__ import annotations

import pathlib
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - dependency guidance only
    sys.exit("Pillow is required: python3 -m pip install Pillow")

# Brand tokens, mirroring src/index.css.
INK_950 = "#161310"
BRASS_500 = "#c8842a"
BRASS_700 = "#855116"

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
]

# Rendered at 4x then downsampled, which antialiases the glyph and the corner
# radius far better than drawing at the target size directly.
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


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    sys.exit(f"No usable serif font found. Tried: {', '.join(FONT_CANDIDATES)}")


def lerp(a: str, b: str, t: float) -> tuple[int, int, int]:
    """Blend two hex colours, used for the mark's brass gradient."""
    ar, ag, ab = (int(a[i : i + 2], 16) for i in (1, 3, 5))
    br, bg, bb = (int(b[i : i + 2], 16) for i in (1, 3, 5))
    return (
        round(ar + (br - ar) * t),
        round(ag + (bg - ag) * t),
        round(ab + (bb - ab) * t),
    )


def render(size: int, maskable: bool) -> Image.Image:
    canvas = size * SUPERSAMPLE
    img = Image.new("RGB", (canvas, canvas), INK_950)
    draw = ImageDraw.Draw(img)

    # A maskable icon must survive a 20% crop on every edge, so the mark shrinks
    # into the safe zone and the ink field bleeds to the boundary instead.
    scale = 0.60 if maskable else 0.82
    tile = canvas * scale
    origin = (canvas - tile) / 2

    # Brass gradient, painted as horizontal bands across the tile. The mark in
    # the app uses linear-gradient(30deg, brass-500, brass-700); a vertical
    # approximation is indistinguishable at icon sizes.
    radius = tile * 0.22
    tile_img = Image.new("RGB", (int(tile), int(tile)), BRASS_500)
    tile_draw = ImageDraw.Draw(tile_img)
    for y in range(int(tile)):
        tile_draw.line(
            [(0, y), (int(tile), y)],
            fill=lerp(BRASS_500, BRASS_700, y / max(1, tile - 1)),
        )

    # Round the tile corners via a mask so the gradient keeps its shape.
    mask = Image.new("L", (int(tile), int(tile)), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, int(tile) - 1, int(tile) - 1], radius=radius, fill=255
    )
    img.paste(tile_img, (int(origin), int(origin)), mask)

    # Sigma, centred on the tile by its rendered bounding box rather than its
    # font metrics -- Georgia's ascent leaves the glyph visibly high otherwise.
    font = load_font(int(tile * 0.62))
    glyph = "Σ"
    left, top, right, bottom = draw.textbbox((0, 0), glyph, font=font)
    draw.text(
        (
            origin + (tile - (right - left)) / 2 - left,
            origin + (tile - (bottom - top)) / 2 - top,
        ),
        glyph,
        font=font,
        fill=INK_950,
    )

    return img.resize((size, size), Image.LANCZOS)


def render_splash(size: int = 2732) -> Image.Image:
    """iOS launch image: the mark centred on the ink field.

    Square at 2732px because iOS crops the same asset to every device aspect
    ratio; anything off-centre or near an edge gets cut on some screen. The mark
    is kept small for that reason.
    """
    img = Image.new("RGB", (size, size), INK_950)
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
