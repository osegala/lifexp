"""Prepare the supplied Evrenthia material art; requires Pillow, no app dependency.

Usage: python3 scripts/prepare-fantasy-ui.py /path/to/supplied/images
Original files stay untouched. Crops remove transparent canvas, not painted corners.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
OUT = ROOT / "assets/ui/fantasy"
OUT.mkdir(parents=True, exist_ok=True)
SPECS = [
    ("07", 1, "screen-parchment", 768, None, None),
    ("09", 2, "parchment-panel", 800, 4, [64, 64, 64, 64]),
    ("11", 3, "bottom-nav-shell", 1086, 3, [48, 12, 48, 32]),
    ("13", 4, "primary-button", 800, 3, [72, 40, 72, 40]),
    ("16", 5, "selected-tab", 600, 5, [70, 56, 70, 56]),
    ("17", 6, "resource-pill", 500, 5, [80, 48, 80, 48]),
    ("19", 7, "input-field", 800, 4, [64, 40, 64, 40]),
    ("22", 8, "parchment-vignette", 640, None, None),
]
manifest = []
for stamp, number, name, width, density, caps in SPECS:
    path = SOURCE / f"ChatGPT Image Oct 20, 2026, 08_37_{stamp} PM-{number}.png"
    image = Image.open(path).convert("RGBA")
    original_size = image.size
    if number == 5:
        # The mock has a quiet warm bloom. Retain the painted green/gold body,
        # while reducing only the saturated blue halo's alpha and warming it.
        image.putdata([
            (188, 161, 97, round(a * 0.12)) if b > r * 1.3 and b > g * 1.12 else (r, g, b, a)
            for r, g, b, a in image.get_flattened_data()
        ])
    crop = (0, 0, *image.size)
    if number == 3:
        # Trim the tall empty canvas and the raised side horns to the straight
        # central upper rim; the fixed navigation fills the safe-area edge.
        crop = (0, 460, image.width, 700)
    elif number not in (1, 8):
        mask = image.getchannel("A").point(lambda a: 255 if a > 32 else 0).filter(ImageFilter.MedianFilter(7))
        left, top, right, bottom = mask.getbbox()
        padding = 14 if number in (4, 5) else 10
        crop = (max(0, left-padding), max(0, top-padding), min(image.width, right+padding), min(image.height, bottom+padding))
    image = image.crop(crop)
    image = image.resize((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)
    # Clear almost invisible fringe pixels from the generated transparency.
    image.putalpha(image.getchannel("A").point(lambda a: 0 if a < 5 else a))
    if number == 1:
        image = image.convert("RGB")
    target = OUT / f"{name}.png"
    image.save(target, optimize=True)
    manifest.append({"role": name, "source": path.name, "sourceSize": original_size,
        "sourceBytes": path.stat().st_size, "crop": crop, "size": image.size,
        "bytes": target.stat().st_size, "density": density, "capsLTRB": caps})
    if number == 2:
        w, h = image.size
        paper = image.crop((w//4, h//4, 3*w//4, 3*h//4)).resize((256, 256), Image.Resampling.LANCZOS)
        paper.save(OUT / "paper-inset.png", optimize=True)
    if number == 4:
        # A muted, readable disabled state rather than fading the whole control.
        muted = ImageEnhance.Color(image.convert("RGB")).enhance(0)
        muted = Image.blend(muted, Image.new("RGB", image.size, "#D8D0BE"), 0.8).convert("RGBA")
        muted.putalpha(image.getchannel("A"))
        muted.save(OUT / "primary-button-disabled.png", optimize=True)
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
