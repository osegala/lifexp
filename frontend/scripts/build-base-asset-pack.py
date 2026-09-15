#!/usr/bin/env python3
"""Build the runtime base-map asset pack from the supplied source sheets.

The source sheets are retained under each ``source`` directory. Runtime files are
cropped, alpha-keyed, and named deterministically so Metro can require them.
"""

from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "assets" / "base"
DOWNLOADS = Path.home() / "Downloads"
PLAYABLE_GROUND_SIZE = (2400, 1400)
WORLD_GROUND_SIZE = (5000, 3000)
WORLD_PLAYABLE_INSET = (1300, 800)
BUILDABLE_CENTER = (WORLD_GROUND_SIZE[0] // 2, WORLD_GROUND_SIZE[1] // 2)
BUILDABLE_RADIUS = (2940, 1522)
BUILDABLE_DIAMOND = [
    (BUILDABLE_CENTER[0], BUILDABLE_CENTER[1] - BUILDABLE_RADIUS[1]),
    (BUILDABLE_CENTER[0] + BUILDABLE_RADIUS[0], BUILDABLE_CENTER[1]),
    (BUILDABLE_CENTER[0], BUILDABLE_CENTER[1] + BUILDABLE_RADIUS[1]),
    (BUILDABLE_CENTER[0] - BUILDABLE_RADIUS[0], BUILDABLE_CENTER[1]),
]
GRASS_VARIANT_SOURCES = {
    "grass": "ChatGPT Image Sep 6, 2026, 06_15_40 PM.png",
    "flowers": "ChatGPT Image Sep 6, 2026, 06_15_46 PM.png",
    "rocks": "ChatGPT Image Sep 6, 2026, 06_15_51 PM.png",
    "worn": "ChatGPT Image Sep 6, 2026, 06_15_56 PM.png",
}

BUILDING_SOURCES = {
    "home-base": [
        "ChatGPT Image Sep 6, 2026, 06_25_25 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_25_20 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_25_15 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_25_09 PM.png",
        "home-base level 5.png",
    ],
    "workshop": [
        "ChatGPT Image Sep 6, 2026, 06_23_16 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_23_08 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_23_02 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_22_45 PM.png",
        "workshops level 5.png",
    ],
    "library": [
        "ChatGPT Image Sep 6, 2026, 06_24_35 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_24_27 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_24_18 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_24_12 PM.png",
        "librarys level 5.png",
    ],
    "training-grounds": [
        "ChatGPT Image Sep 6, 2026, 06_21_45 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_21_40 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_21_35 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_21_28 PM.png",
        "taining grounds level 5.png",
    ],
    "garden": [
        "ChatGPT Image Sep 6, 2026, 06_20_52 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_20_47 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_20_41 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_20_35 PM.png",
        "garden level 5.png",
    ],
    "hall-of-achievement": [
        "ChatGPT Image Sep 6, 2026, 06_20_01 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_19_54 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_19_34 PM.png",
        "ChatGPT Image Sep 6, 2026, 06_19_12 PM.png",
        "hall of Achievements Level 5.png",
    ],
}


def remove_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] == 0:
        return rgba
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            spread = max(r, g, b) - min(r, g, b)
            # The supplied sheets contain a baked light-grey checkerboard.
            # Only neutral, very bright pixels are removed so stone/wood survive.
            if min(r, g, b) >= 188 and spread <= 20:
                alpha = max(0, min(255, (210 - min(r, g, b)) * 12))
                pixels[x, y] = (r, g, b, min(a, alpha))
    return rgba


def build_buildings() -> None:
    for building, sources in BUILDING_SOURCES.items():
        for level, filename in enumerate(sources, start=1):
            source = Image.open(DOWNLOADS / filename)
            already_transparent = source.mode == "RGBA" and source.getchannel("A").getextrema()[0] == 0
            image = remove_checkerboard(source)
            if not already_transparent:
                image = keep_largest_component(image)
            alpha_box = image.getchannel("A").getbbox()
            if alpha_box:
                image = image.crop(alpha_box)
            image.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (1024, 1024))
            canvas.alpha_composite(image, ((1024 - image.width) // 2, 1024 - image.height))
            destination = ROOT / "buildings" / building / f"{building}-level-{level}.png"
            canvas.save(destination, optimize=True)


def diamond_texture(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    texture = image.crop(box).convert("RGBA").resize((170, 88), Image.Resampling.LANCZOS)
    mask = Image.new("L", texture.size)
    ImageDraw.Draw(mask).polygon([(85, 0), (169, 44), (85, 87), (0, 44)], fill=255)
    texture.putalpha(mask)
    return texture


def match_grass_color(tile: Image.Image, reference: Image.Image) -> Image.Image:
    def is_grass(pixel: tuple[int, int, int, int]) -> bool:
        r, g, b, a = pixel
        return a > 32 and g > r * 1.18 and g > b * 1.12

    source_pixels = [pixel for pixel in tile.get_flattened_data() if is_grass(pixel)]
    reference_pixels = [pixel for pixel in reference.get_flattened_data() if is_grass(pixel)]
    if not source_pixels or not reference_pixels:
        return tile
    source_mean = [sum(pixel[channel] for pixel in source_pixels) / len(source_pixels) for channel in range(3)]
    target_mean = [sum(pixel[channel] for pixel in reference_pixels) / len(reference_pixels) for channel in range(3)]
    scale = [target_mean[channel] / max(source_mean[channel], 1) for channel in range(3)]
    output = tile.copy()
    pixels = output.load()
    for y in range(output.height):
        for x in range(output.width):
            pixel = pixels[x, y]
            if is_grass(pixel):
                r, g, b, a = pixel
                pixels[x, y] = tuple(
                    min(255, round(value * scale[channel]))
                    for channel, value in enumerate((r, g, b))
                ) + (a,)
    return output


def clear_edge_checkerboard(image: Image.Image) -> Image.Image:
    """Remove only neutral checker pixels connected to the crop boundary."""
    output = image.convert("RGBA")
    pixels = output.load()
    width, height = output.size

    def is_checker(x: int, y: int) -> bool:
        r, g, b, a = pixels[x, y]
        return a > 0 and min(r, g, b) >= 184 and max(r, g, b) - min(r, g, b) <= 24

    pending: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()
    for x in range(width):
        pending.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        pending.extend(((0, y), (width - 1, y)))

    while pending:
        x, y = pending.popleft()
        if (x, y) in seen or not is_checker(x, y):
            continue
        seen.add((x, y))
        if x > 0:
            pending.append((x - 1, y))
        if x + 1 < width:
            pending.append((x + 1, y))
        if y > 0:
            pending.append((x, y - 1))
        if y + 1 < height:
            pending.append((x, y + 1))

    for x, y in seen:
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
    return output


def choose_grass_variant(
    variants: dict[str, Image.Image],
    u: int,
    v: int,
) -> Image.Image:
    """Choose stable terrain detail while preserving its isometric viewpoint."""
    mixed = (u * 73856093) ^ (v * 19349663) ^ ((u + v) * 83492791)
    mixed = (mixed ^ (mixed >> 13)) * 1274126177
    selector = (mixed ^ (mixed >> 16)) & 255
    if selector < 214:
        name = "grass"
    elif selector < 246:
        name = "flowers"
    elif selector < 252:
        name = "worn"
    else:
        name = "rocks"
    # These source tiles include front-facing soil walls, directional lighting,
    # and isometric foliage. Rotating them as square textures breaks all three.
    return variants[name]


def composite_boundary_forest(world: Image.Image, origin_x: int, origin_y: int) -> None:
    """Fill the non-buildable diamond exterior with an overlapping canopy."""
    tree_sources = {
        "pine": Image.open(ROOT / "decorations" / "pine-tree.png").convert("RGBA"),
        "oak": Image.open(ROOT / "decorations" / "oak-tree.png").convert("RGBA"),
    }
    tree_tones: dict[str, list[Image.Image]] = {}
    for name, source in tree_sources.items():
        tree_tones[name] = [
            ImageEnhance.Brightness(
                ImageEnhance.Color(source).enhance(saturation),
            ).enhance(brightness)
            for saturation, brightness in ((0.9, 0.86), (1.0, 0.94), (1.05, 1.0))
        ]

    placements: list[tuple[int, int, int, Image.Image, bool]] = []
    center_x, center_y = BUILDABLE_CENTER
    radius_x, radius_y = BUILDABLE_RADIUS
    for u in range(-56, 57):
        for v in range(-56, 57):
            x = origin_x + (u + v) * 85
            y = origin_y + (u - v) * 44
            if not (-80 <= x <= WORLD_GROUND_SIZE[0] + 80 and 35 <= y <= WORLD_GROUND_SIZE[1] + 45):
                continue
            boundary_score = abs(x - center_x) / radius_x + abs(y - center_y) / radius_y
            if boundary_score < 0.97:
                continue

            mixed = (
                (u * 73856093)
                ^ (v * 19349663)
                ^ ((u + v) * 83492791)
            ) & 0xFFFFFFFF
            tree_name = "pine" if ((mixed >> 7) % 100) < 76 else "oak"
            tree = tree_tones[tree_name][(mixed >> 18) % 3]
            frontier = boundary_score < 1.035
            height = (170 if frontier else 154) + ((mixed >> 12) % 34)
            width = round(tree.width * height / tree.height)
            jitter_x = ((mixed >> 23) % 29) - 14
            jitter_y = ((mixed >> 28) % 13) - 6
            placements.append((y + jitter_y, x + jitter_x, height, tree, frontier))

    for anchor_y, anchor_x, height, tree, frontier in sorted(placements):
        # The boundary row keeps complete trunks to clearly mark the buildable
        # edge. Deeper rows use foliage-only crops, producing a continuous roof
        # of treetops instead of hundreds of individually readable trees.
        source = tree if frontier else tree.crop((0, 0, tree.width, round(tree.height * 0.74)))
        width = round(source.width * height / source.height)
        rendered = source.resize((width, height), Image.Resampling.LANCZOS)
        world.alpha_composite(rendered, (anchor_x - width // 2, anchor_y - height + 18))


def build_cohesive_path_tile(stone_texture: Image.Image, mask_value: int) -> Image.Image:
    """Build a road whose four exits meet the actual shared isometric edges.

    Runtime bits are grid neighbors, not image tips:
    1=south-west edge, 2=south-east, 4=north-east, 8=north-west.
    Drawing in a square first and projecting it into a diamond keeps every
    straight, corner, and junction at a consistent world-space width.
    """
    logical_size = 256
    logical = Image.new("L", (logical_size, logical_size))
    draw = ImageDraw.Draw(logical)
    center = (128, 128)
    exits = {
        1: (128, 256),
        2: (256, 128),
        4: (128, 0),
        8: (0, 128),
    }
    road_width = 76

    if mask_value == 0:
        draw.ellipse((73, 73, 183, 183), fill=255)
    else:
        for bit, endpoint in exits.items():
            if mask_value & bit:
                draw.line((center, endpoint), fill=255, width=road_width)
        # A shared center removes pinholes where three or four branches meet.
        draw.ellipse((90, 90, 166, 166), fill=255)

    # Inverse of the square-to-isometric projection used by the map grid.
    mask = logical.transform(
        (170, 88),
        Image.Transform.AFFINE,
        (256 / 170, 256 / 88, -128, -256 / 170, 256 / 88, 128),
        resample=Image.Resampling.BICUBIC,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(0.45))

    # Use paving sampled from the supplied full-stone tile. Cropping away its
    # baked grass perimeter prevents each road piece from looking like a card.
    paving = stone_texture.crop((35, 15, 135, 73)).resize(
        (170, 88),
        Image.Resampling.LANCZOS,
    ).convert("RGBA")
    paving.putalpha(mask)

    # A restrained ground-contact edge makes the paving readable while the
    # transparent exterior lets the map's real grass show through unchanged.
    outline = mask.filter(ImageFilter.MaxFilter(7))
    outline = ImageChops.subtract(outline, mask)
    shadow = Image.new("RGBA", (170, 88), (77, 82, 47, 0))
    shadow.putalpha(outline.point(lambda alpha: round(alpha * 0.58)))

    output = Image.new("RGBA", (170, 88))
    output.alpha_composite(shadow)
    output.alpha_composite(paving)
    return output


def build_tiled_ground_and_paths() -> None:
    stone_source = Image.open(ROOT / "tiles" / "source" / "stone-path-sprite-sheet.png").convert("RGBA")
    grass_sources = {
        name: diamond_texture(Image.open(DOWNLOADS / filename), (180, 42, 1358, 878))
        for name, filename in GRASS_VARIANT_SOURCES.items()
    }
    grass = grass_sources["grass"]
    grass = ImageEnhance.Color(grass).enhance(0.76)
    grass = ImageEnhance.Brightness(grass).enhance(0.86)

    grass_variants: dict[str, Image.Image] = {}
    for name, source in grass_sources.items():
        balanced = ImageEnhance.Color(source).enhance(0.76)
        balanced = ImageEnhance.Brightness(balanced).enhance(0.86)
        balanced = match_grass_color(balanced, grass)
        grass_variants[name] = balanced
        balanced.save(ROOT / "tiles" / f"grass-{name}.png", optimize=True)

    grass.save(ROOT / "tiles" / "grass.png", optimize=True)
    row_surface_bounds = [(55, 285), (18, 263), (7, 243)]
    atlas_tiles: list[Image.Image] = []
    for index in range(15):
        column, row = index % 5, index // 5
        left = round(column * stone_source.width / 5)
        right = round((column + 1) * stone_source.width / 5)
        row_top = round(row * stone_source.height / 3)
        surface_top, surface_bottom = row_surface_bounds[row]
        tile = clear_edge_checkerboard(stone_source.crop(
            (left + 15, row_top + surface_top, right - 1, row_top + surface_bottom),
        )).resize((170, 88), Image.Resampling.LANCZOS)
        mask = Image.new("L", tile.size)
        # Inset the mask to exclude the baked checker fringe and soil extrusion.
        ImageDraw.Draw(mask).polygon([(85, 4), (162, 44), (85, 83), (8, 44)], fill=255)
        tile.putalpha(ImageChops.multiply(tile.getchannel("A"), mask))
        atlas_tiles.append(match_grass_color(tile, grass))

    runtime_tiles = {
        mask_value: build_cohesive_path_tile(atlas_tiles[0], mask_value)
        for mask_value in range(16)
    }
    for mask_value, tile in runtime_tiles.items():
        tile.save(
            ROOT / "tiles" / f"stone-mask-{mask_value:02d}.png",
            optimize=True,
        )

    ground = Image.new("RGBA", PLAYABLE_GROUND_SIZE, (91, 126, 65, 255))
    cells = []
    for u in range(-24, 25):
        for v in range(-24, 25):
            x = 1217 + (u + v) * 85
            y = 702 + (u - v) * 44
            if -170 <= x <= 2470 and -88 <= y <= 1488:
                cells.append((y, x, u, v))
    for y, x, u, v in sorted(cells):
        tile = choose_grass_variant(grass_variants, u, v)
        ground.alpha_composite(tile, (x - 85, y - 44))

    # Extend the visual world around the buildable diamond. The darker terrain
    # uses the same tile scale and grid phase, making the limit readable without
    # introducing a second or misaligned background layer.
    dark_grass_variants = {
        name: ImageEnhance.Brightness(
            ImageEnhance.Color(tile).enhance(0.72),
        ).enhance(0.62)
        for name, tile in grass_variants.items()
    }
    world = Image.new("RGBA", WORLD_GROUND_SIZE, (50, 73, 43, 255))
    bright_world = Image.new("RGBA", WORLD_GROUND_SIZE, (91, 126, 65, 255))
    world_origin_x = 1217 + WORLD_PLAYABLE_INSET[0]
    world_origin_y = 702 + WORLD_PLAYABLE_INSET[1]
    world_cells = []
    for u in range(-40, 41):
        for v in range(-40, 41):
            x = world_origin_x + (u + v) * 85
            y = world_origin_y + (u - v) * 44
            if -170 <= x <= WORLD_GROUND_SIZE[0] + 70 and -88 <= y <= WORLD_GROUND_SIZE[1] + 88:
                world_cells.append((y, x, u, v))
    for y, x, u, v in sorted(world_cells):
        world.alpha_composite(
            choose_grass_variant(dark_grass_variants, u, v),
            (x - 85, y - 44),
        )
        bright_world.alpha_composite(
            choose_grass_variant(grass_variants, u, v),
            (x - 85, y - 44),
        )

    # The legal area follows the same 170:88 isometric-diamond proportions as
    # a terrain tile. Supersampling keeps the large boundary clean and avoids
    # returning to an axis-aligned rectangular patch.
    boundary_scale = 4
    boundary_mask_large = Image.new(
        "L",
        (
            WORLD_GROUND_SIZE[0] * boundary_scale,
            WORLD_GROUND_SIZE[1] * boundary_scale,
        ),
    )
    ImageDraw.Draw(boundary_mask_large).polygon(
        [(x * boundary_scale, y * boundary_scale) for x, y in BUILDABLE_DIAMOND],
        fill=255,
    )
    boundary_mask = boundary_mask_large.resize(
        WORLD_GROUND_SIZE,
        Image.Resampling.LANCZOS,
    )
    world = Image.composite(bright_world, world, boundary_mask)
    composite_boundary_forest(world, world_origin_x, world_origin_y)
    world.convert("RGB").save(ROOT / "backgrounds" / "tiled-ground.png", optimize=True)


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    active = {(x, y) for y in range(height) for x in range(width) if alpha.getpixel((x, y)) > 24}
    components: list[set[tuple[int, int]]] = []
    while active:
        start = active.pop()
        component = {start}
        stack = [start]
        while stack:
            x, y = stack.pop()
            for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if point in active:
                    active.remove(point)
                    component.add(point)
                    stack.append(point)
        components.append(component)
    if not components:
        return image
    keep = max(components, key=len)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in keep:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    return image


def crop_clean(
    source: Image.Image,
    box: tuple[int, int, int, int],
    destination: Path,
    isolate: bool = False,
) -> None:
    image = remove_checkerboard(source.crop(box))
    if isolate:
        image = keep_largest_component(image)
    alpha_box = image.getchannel("A").getbbox()
    if alpha_box:
        image = image.crop(alpha_box)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, optimize=True)


def build_decorations() -> None:
    source = Image.open(ROOT / "decorations" / "source" / "map-decoration-sprite-sheet.png")
    crops = {
        "flowers-white": (140, 18, 255, 135),
        "flowers-blue": (640, 18, 755, 145),
        "rock-large": (12, 145, 175, 305),
        "rock-cluster": (400, 145, 565, 305),
        "bush": (10, 300, 170, 450),
        "bush-flowers": (150, 300, 285, 455),
        "oak-tree": (218, 430, 370, 650),
        # The pine's canopy spans roughly x=392..499. Keep generous transparent
        # padding here so no branch is clipped before component isolation.
        "pine-tree": (365, 400, 530, 670),
        "wood-fence": (8, 625, 225, 775),
        "stone-wall": (430, 620, 665, 780),
        "lamp-post": (244, 765, 322, 935),
        "bench": (325, 760, 490, 935),
        "crate-stack": (938, 760, 1045, 925),
        "barrels": (1072, 760, 1175, 930),
        "well": (120, 905, 285, 1085),
        "planter-flowers": (260, 910, 430, 1085),
        "campfire": (540, 915, 625, 1090),
        "log-pile": (662, 910, 770, 1085),
    }
    for name, box in crops.items():
        crop_clean(source, box, ROOT / "decorations" / f"{name}.png", isolate=True)


if __name__ == "__main__":
    build_buildings()
    build_decorations()
    build_tiled_ground_and_paths()
    print("Built 30 buildings, a 5000x3000 forest-bounded tiled world, 16 path tiles, and 18 props.")
