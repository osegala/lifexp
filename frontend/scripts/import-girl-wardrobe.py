"""Copy supplied artwork unchanged and trace limb alpha into SVG clip paths.

The limb files include a translucent glow outside the actual skin outline.
Only vector clipping metadata is generated; PNG pixels are never rewritten.
Requires Pillow for reading the source alpha channel.
"""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets/avatar/v2"
DOWNLOADS = Path(sys.argv[1])
BODY = {
    "head": "03_20_52 PM (1)", "torso": "03_20_52 PM (2)",
    "left-arm": "03_20_52 PM (3)", "right-leg": "03_20_53 PM (4)",
    "right-arm": "03_20_53 PM (5)", "left-leg": "03_20_54 PM (6)",
}
DRESSES = {
    "starlight": "03_21_24 PM (1)", "forest-ranger": "03_21_24 PM (2)",
    "frostbound": "03_21_25 PM (3)", "teal-wayfarer": "03_21_26 PM (4)",
    "crimson-guard": "03_21_26 PM (5)", "royal-vanguard": "03_21_27 PM (6)",
    "royal-bard": "03_21_27 PM (7)", "harbor-scout": "03_21_29 PM (8)",
    "verdant-warden": "03_21_30 PM (9)", "celestial-acolyte": "03_21_31 PM (10)",
}


def simplify(points, tolerance=1):
    if len(points) < 3:
        return points
    x, y = points[0]
    dx, dy = points[-1][0] - x, points[-1][1] - y
    norm = max((dx * dx + dy * dy) ** .5, .01)
    distances = [abs(dy * (px - x) - dx * (py - y)) / norm for px, py in points[1:-1]]
    maximum = max(distances, default=0)
    if maximum <= tolerance:
        return [points[0], points[-1]]
    split = distances.index(maximum) + 1
    return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)


def alpha_outline(image):
    alpha = image.getchannel("A")
    w, h = image.size
    data = alpha.tobytes()
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and data[y * w + x] >= 160
    edges = {}
    for y in range(h):
        for x in range(w):
            if not solid(x, y):
                continue
            for adjacent, start, end in [
                ((x, y - 1), (x, y), (x + 1, y)),
                ((x + 1, y), (x + 1, y), (x + 1, y + 1)),
                ((x, y + 1), (x + 1, y + 1), (x, y + 1)),
                ((x - 1, y), (x, y + 1), (x, y)),
            ]:
                if not solid(*adjacent):
                    edges.setdefault(start, []).append(end)
    loops = []
    while edges:
        start = next(iter(edges))
        points, current = [start], start
        while current in edges:
            target = edges[current].pop()
            if not edges[current]:
                del edges[current]
            points.append(target)
            current = target
            if current == start:
                break
        if len(points) > 30:
            # Split a closed loop before simplifying to retain its full outline.
            mid = len(points) // 2
            points = simplify(points[:mid + 1])[:-1] + simplify(points[mid:])
            loops.append("M" + "L".join(f"{x} {y}" for x, y in points) + "Z")
    return " ".join(loops)


silhouettes = {}
for folder, mapping in [("body-girl", BODY), ("dresses", DRESSES)]:
    directory = ROOT / folder
    directory.mkdir(exist_ok=True)
    for name, suffix in mapping.items():
        source = DOWNLOADS / f"ChatGPT Image Sep 14, 2026, {suffix}.png"
        destination = directory / f"{name}.png"
        shutil.copyfile(source, destination)
        if folder == "body-girl" and ("arm" in name or "leg" in name):
            silhouettes[name] = alpha_outline(Image.open(source))
        print(f"Imported {folder}/{name}.png unchanged")
(ROOT / "body-girl/silhouettes.json").write_text(json.dumps(silhouettes, indent=2) + "\n")
