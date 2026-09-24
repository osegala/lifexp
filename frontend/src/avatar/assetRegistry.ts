import { ImageSourcePropType } from "react-native";

import type { BodyRegion, CharacterLayer } from "./cosmeticCatalog";
import type { BootCuff, ImageCrop, SpriteFrame, TrouserLeg } from "./spriteLayout";
import { Cosmetic, CosmeticId, CosmeticType, EquipmentSlot } from "../types/avatar";
import girlSilhouettes from "../../assets/avatar/v2/body-girl/silhouettes.json";

export type CharacterSpriteDefinition = {
  id: string;
  source: ImageSourcePropType;
  layer: CharacterLayer;
  frame?: SpriteFrame;
  bootCuff?: BootCuff;
  trouserLegs?: readonly TrouserLeg[];
  hairClip?: string;
  headClip?: string;
  clipPath?: string;
  hairPart?: "ponytail";
  tuckPonytail?: boolean;
  fullOutfit?: boolean;
};

export type BaseBodySpriteDefinition = CharacterSpriteDefinition & { region?: BodyRegion };

export type CharacterSpriteSet = readonly CharacterSpriteDefinition[];

export type ResolvedCharacterSprite = {
  key: string;
  layer: CharacterLayer;
  source: ImageSourcePropType;
  region?: BodyRegion;
  covers?: readonly BodyRegion[];
  frame?: SpriteFrame;
  bootCuff?: BootCuff;
  trouserLegs?: readonly TrouserLeg[];
  hairClip?: string;
  headClip?: string;
  clipPath?: string;
  hairPart?: "ponytail";
  tuckPonytail?: boolean;
  fullOutfit?: boolean;
};

type CosmeticAssetDefinition = {
  slot: EquipmentSlot;
  previewSource: ImageSourcePropType;
  previewCrop?: ImageCrop;
  sprites?: CharacterSpriteSet;
  covers?: readonly BodyRegion[];
  sceneSource?: ImageSourcePropType;
};

const sprite = (id: string, layer: CharacterLayer, source: ImageSourcePropType):
  CharacterSpriteDefinition => ({ id, layer, source });

// The ears and jaw belong in front of the nape and side locks. Keep only the
// crown/fringe above the face; the full rear sprite supplies the outer outline.
const HAIR_FRINGE_CLIP = "M0 -64H1254V158H708Q702 168 695 200H559Q552 168 546 158H0Z";
// Split below the temple tips, in the gap before the short styles' rear nape.
const SHORT_HAIR_FRINGE_CLIP = "M0 -64H1254V202H0Z";
// These openings follow the neutral head's ear silhouette. The rear layer
// remains visible behind the ears while loose curls can fall in front of the face.
const HAIR_EAR_OPENINGS = [
  "M533 160L526 164L524 168L523 172L522 176V184L523 188L524 192L526 196L529 200L532 204L537 208L542 212L548 216L557 219L565 220L550 180L543 166Z",
  "M721 160L728 164L730 168L731 172L732 176V184L731 188L730 192L728 196L725 200L722 204L717 208L712 212L706 216L697 219L689 220L704 180L711 166Z",
].join(" ");

function layeredHair(source: ImageSourcePropType, frame?: SpriteFrame, drape = false): CharacterSpriteSet {
  return [
    { id: "back", layer: drape ? "hairDrape" : "hairBack", source, frame },
    { id: "front", layer: "hairFront", source, frame,
      clipPath: drape ? HAIR_FRINGE_CLIP : SHORT_HAIR_FRINGE_CLIP },
  ];
}

// The flattened master remains in assets as a registration reference only.
// It is intentionally not registered or rendered while the modular body is tested.
const BODY_HEAD = require("../../assets/avatar/v2/body/head.png");
const BODY_NECK = require("../../assets/avatar/v2/body/neck.png");
const BODY_TORSO = require("../../assets/avatar/v2/body/torso.png");
const BODY_LEFT_ARM = require("../../assets/avatar/v2/body/left-arm.png");
const BODY_RIGHT_ARM = require("../../assets/avatar/v2/body/right-arm.png");
const BODY_LEFT_LEG = require("../../assets/avatar/v2/body/left-leg.png");
const BODY_RIGHT_LEG = require("../../assets/avatar/v2/body/right-leg.png");

const WINDBLOWN_LAYERS_HAIR = require("../../assets/avatar/v2/aligned/windblown-layers-hair.png");
const SIDE_SWEPT_LAYERS_HAIR = require("../../assets/avatar/v2/aligned/side-swept-layers-hair.png");
const SPRING_CURLS_HAIR = require("../../assets/avatar/v2/aligned/spring-curls-hair.png");
const SKYWARD_SPIKES_HAIR = require("../../assets/avatar/v2/aligned/skyward-spikes-hair.png");
const TOUSLED_LAYERS_HAIR = require("../../assets/avatar/v2/aligned/tousled-layers-hair.png");
const CURTAIN_BOB_HAIR = require("../../assets/avatar/v2/aligned/curtain-bob-hair.png");
const FEATHERED_SWEEP_HAIR = require("../../assets/avatar/v2/aligned/feathered-sweep-hair.png");
const AZURE_FEATHER_CAP = require("../../assets/avatar/v2/aligned/azure-feather-cap.png");
const GUILD_TUNIC = require("../../assets/avatar/v2/aligned/guild-tunic.png");
const GUILD_BELT = require("../../assets/avatar/v2/aligned/guild-belt.png");
const MIDNIGHT_VANGUARD_TUNIC = require("../../assets/avatar/v2/aligned/midnight-vanguard.png");
const ROYAL_BLOOM_TUNIC = require("../../assets/avatar/v2/aligned/royal-bloom.png");
const CELESTIAL_ACOLYTE_TUNIC = require("../../assets/avatar/v2/aligned/celestial-acolyte.png");
const HARBOR_SCOUT_TUNIC = require("../../assets/avatar/v2/aligned/harbor-scout.png");
const VERDANT_WARDEN_TUNIC = require("../../assets/avatar/v2/aligned/verdant-warden.png");
const FROSTBOUND_VEST_TUNIC = require("../../assets/avatar/v2/aligned/frostbound-vest.png");
const TEAL_WAYFARER_TUNIC = require("../../assets/avatar/v2/aligned/teal-wayfarer.png");
const STAR_CAPTAIN_TUNIC = require("../../assets/avatar/v2/aligned/star-captain.png");
const CRIMSON_GUARD_TUNIC = require("../../assets/avatar/v2/aligned/crimson-guard.png");
const FOREST_RANGER_TUNIC = require("../../assets/avatar/v2/aligned/forest-ranger.png");
const TRAVELER_TROUSERS_WAIST = require("../../assets/avatar/v2/aligned/traveler-trousers-waist.png");
const TRAVELER_TROUSERS_LEFT_LEG = require("../../assets/avatar/v2/aligned/traveler-trousers-left-leg.png");
const TRAVELER_TROUSERS_RIGHT_LEG = require("../../assets/avatar/v2/aligned/traveler-trousers-right-leg.png");
const GUILD_BOOTS_LEFT = require("../../assets/avatar/v2/aligned/guild-boots-left.png");
const GUILD_BOOTS_RIGHT = require("../../assets/avatar/v2/aligned/guild-boots-right.png");

const CELESTIAL_CITADEL_BACKGROUND = require("../../assets/avatar/v2/backgrounds/celestial-citadel.png");
const SUNSET_HARBOR_BACKGROUND = require("../../assets/avatar/v2/backgrounds/sunset-harbor.png");
const GRAND_LIBRARY_BACKGROUND = require("../../assets/avatar/v2/backgrounds/grand-library.png");
const FESTIVAL_MARKET_BACKGROUND = require("../../assets/avatar/v2/backgrounds/festival-market.png");
const DESERT_OASIS_BACKGROUND = require("../../assets/avatar/v2/backgrounds/desert-oasis.png");
const SNOWY_VILLAGE_BACKGROUND = require("../../assets/avatar/v2/backgrounds/snowy-village.png");
const CRYSTAL_CAVERN_BACKGROUND = require("../../assets/avatar/v2/backgrounds/crystal-cavern.png");
const ROYAL_TRAINING_YARD_BACKGROUND = require("../../assets/avatar/v2/backgrounds/royal-training-yard.png");
const CASTLE_GARDEN_BACKGROUND = require("../../assets/avatar/v2/backgrounds/castle-garden.png");
const MOONLIT_GLADE_BACKGROUND = require("../../assets/avatar/v2/backgrounds/moonlit-glade.png");
const SKY_GRIFFIN_PET = require("../../assets/avatar/v2/pets/sky-griffin.png");
const MOSS_GOLEM_PET = require("../../assets/avatar/v2/pets/moss-golem.png");
const STARLIGHT_CAT_PET = require("../../assets/avatar/v2/pets/starlight-cat.png");
const TIDE_TURTLE_PET = require("../../assets/avatar/v2/pets/tide-turtle.png");
const CRYSTAL_HARE_PET = require("../../assets/avatar/v2/pets/crystal-hare.png");
const EMBER_DRAKE_PET = require("../../assets/avatar/v2/pets/ember-drake.png");
const CLOUD_RAM_PET = require("../../assets/avatar/v2/pets/cloud-ram.png");
const SCHOLAR_OWL_PET = require("../../assets/avatar/v2/pets/scholar-owl.png");
const SUNFIRE_FOX_PET = require("../../assets/avatar/v2/pets/sunfire-fox.png");
const VERDANT_DRAKE_PET = require("../../assets/avatar/v2/pets/verdant-drake.png");
const PRISMATIC_RADIANCE_AURA = require("../../assets/avatar/v2/auras/prismatic-radiance.png");
const HEARTBLOOM_AURA = require("../../assets/avatar/v2/auras/heartbloom.png");
const CRYSTAL_HALO_AURA = require("../../assets/avatar/v2/auras/crystal-halo.png");
const TEMPEST_SURGE_AURA = require("../../assets/avatar/v2/auras/tempest-surge.png");
const ASTRAL_VORTEX_AURA = require("../../assets/avatar/v2/auras/astral-vortex.png");
const SERAPHIC_LIGHT_AURA = require("../../assets/avatar/v2/auras/seraphic-light.png");
const FROSTVEIL_AURA = require("../../assets/avatar/v2/auras/frostveil.png");
const PHOENIX_FLAME_AURA = require("../../assets/avatar/v2/auras/phoenix-flame.png");
const VERDANT_WISPS_AURA = require("../../assets/avatar/v2/auras/verdant-wisps.png");
const ARCANE_CONSTELLATION_AURA = require("../../assets/avatar/v2/auras/arcane-constellation.png");

const GUILD_TUNIC_SPRITES = [
  sprite("vest", "upperBody", GUILD_TUNIC),
  sprite("belt", "belt", GUILD_BELT),
] satisfies CharacterSpriteSet;

const TRAVELER_TROUSERS_SPRITES = [
  sprite("right-leg", "bottoms", TRAVELER_TROUSERS_RIGHT_LEG),
  sprite("left-leg", "bottoms", TRAVELER_TROUSERS_LEFT_LEG),
  sprite("waist", "bottoms", TRAVELER_TROUSERS_WAIST),
] satisfies CharacterSpriteSet;

const GUILD_BOOTS_SPRITES = [
  { ...sprite("right-boot", "boots", GUILD_BOOTS_RIGHT), bootCuff: { x: 519, y: 960, width: 84 } },
  { ...sprite("left-boot", "boots", GUILD_BOOTS_LEFT), bootCuff: { x: 737, y: 965, width: 84 } },
] satisfies CharacterSpriteSet;

type ArtworkBounds = readonly [number, number, number, number];

function artworkCrop(bounds: ArtworkBounds): ImageCrop {
  const [left, top, right, bottom] = bounds;
  return {
    x: left - 4,
    y: top - 4,
    width: right - left + 8,
    height: bottom - top + 8,
    sourceWidth: 1254,
    sourceHeight: 1254,
  };
}

function sourceFrame(
  size: readonly [number, number],
  bounds: ArtworkBounds,
  destination: readonly [number, number, number, number],
  sourceClipPath?: string,
  shearX?: number,
): SpriteFrame {
  const [x, y, right, bottom] = bounds;
  const [dx, dy, width, height] = destination;
  return {
    crop: { x, y, width: right - x, height: bottom - y, sourceWidth: size[0], sourceHeight: size[1] },
    destination: { x: dx, y: dy, width, height }, sourceClipPath, shearX,
  };
}

/** Dresses share the outfit slot on both bodies; saved trousers stay underneath. */
function dressAsset(
  source: ImageSourcePropType,
  bounds: ArtworkBounds,
  shoulderY: number,
  waistY: number,
): CosmeticAssetDefinition {
  const [left, top, right, bottom] = bounds;
  return {
    slot: "upperBody", previewSource: source,
    previewCrop: { x: left - 4, y: top - 4, width: right - left + 8, height: bottom - top + 8, sourceWidth: 1086, sourceHeight: 1448 },
    sprites: [
      { id: "collar", from: top - 4, to: shoulderY, y: 250, height: 45 },
      { id: "bodice", from: shoulderY, to: waistY, y: 295, height: 275 },
      { id: "skirt", from: waistY, to: bottom + 4, y: 570, height: 610 },
    ].map(({ id, from, to, y, height }) => ({
      id, layer: "upperBody", source, fullOutfit: true,
      frame: sourceFrame([1086, 1448], [0, from, 1086, to], [274.05, y, 705.9, height]),
    })),
  };
}

function framedHair(
  source: ImageSourcePropType,
  bounds: ArtworkBounds,
  anchor: readonly [number, number],
  scale: readonly [number, number],
  target: readonly [number, number],
  ponytail = false,
): CosmeticAssetDefinition {
  const crop = artworkCrop(bounds);
  const frame = {
    crop, destination: {
      x: target[0] + (crop.x - anchor[0]) * scale[0],
      y: target[1] + (crop.y - anchor[1]) * scale[1],
      width: crop.width * scale[0], height: crop.height * scale[1],
    },
  };
  return {
    slot: "hair", previewSource: source, previewCrop: crop,
    // The main crown overlaps the rear tail above the ears so the head cannot
    // reveal a bare strip along the curved split. Only the tail moves under caps.
    sprites: ponytail ? [
      { id: "tail", layer: "hairBack", source, frame, hairPart: "ponytail",
        clipPath: "M609 -64H1254V1254H714V216Q736 122 695 69Q663 36 609 42Z" },
      { id: "back", layer: "hairDrape", source, frame,
        clipPath: "M0 -64H609V42Q663 36 695 69Q736 122 714 216V1254H0Z" },
      { id: "front", layer: "hairFront", source, frame,
        clipPath: `M0 -64H1254V158H725Q725 190 714 216V1254H0Z ${HAIR_EAR_OPENINGS}` },
    ] : layeredHair(source, frame, true),
  };
}

/** Align the opening to the forehead, rather than centering the entire hat. */
function hatAsset(
  source: ImageSourcePropType,
  bounds: ArtworkBounds,
  foreheadY: number,
  fit: "cap" | "hood" | "circlet" = "cap",
): CosmeticAssetDefinition {
  const crop = artworkCrop(bounds);
  const scale = 0.29;
  const hairClip = fit === "circlet" ? undefined : fit === "hood"
    ? "M627 105Q687 112 707 165L697 245L709 295H1254V1254H0V295H545L557 245L547 165Q567 112 627 105Z"
    : "M0 160H520L532 122Q627 70 722 122L734 160H1254V1254H0Z";
  return {
    slot: "head", previewSource: source, previewCrop: crop,
    sprites: [{ id: "hat", layer: "headwear", source, hairClip, tuckPonytail: fit === "cap",
      headClip: fit === "hood" ? hairClip : undefined, frame: {
      crop, destination: {
        x: 627 + (crop.x - 627) * scale,
        y: 112 + (crop.y - foreheadY) * scale,
        width: crop.width * scale, height: crop.height * scale,
      },
    } }],
  };
}

/** Preserve supplied PNGs and fit their visible artwork to the waist/ankle anchors. */
function trousersAsset(
  source: ImageSourcePropType,
  bounds: ArtworkBounds,
  legMeasurements: readonly [number, number, number, number],
): CosmeticAssetDefinition {
  const crop = artworkCrop(bounds);
  return {
    slot: "bottoms",
    previewSource: source,
    previewCrop: crop,
    sprites: [{
      id: "trousers",
      layer: "bottoms",
      source,
      trouserLegs: [
        { x: legMeasurements[0], width: legMeasurements[1] },
        { x: legMeasurements[2], width: legMeasurements[3] },
      ],
      frame: {
        crop,
        destination: {
          x: 627 + (crop.x - 627) * 0.65,
          y: 568,
          width: crop.width * 0.65,
          height: 536,
        },
      },
    }],
  };
}

/** Each shoe needs its own frame: the source pair's spacing is not the avatar's stance. */
function bootsAsset(
  source: ImageSourcePropType,
  screenLeftBounds: ArtworkBounds,
  screenRightBounds: ArtworkBounds,
  screenLeftCuff: readonly [number, number, number],
  screenRightCuff: readonly [number, number, number],
): CosmeticAssetDefinition {
  const previewBounds: ArtworkBounds = [
    Math.min(screenLeftBounds[0], screenRightBounds[0]),
    Math.min(screenLeftBounds[1], screenRightBounds[1]),
    Math.max(screenLeftBounds[2], screenRightBounds[2]),
    Math.max(screenLeftBounds[3], screenRightBounds[3]),
  ];
  return {
    slot: "boots",
    previewSource: source,
    previewCrop: artworkCrop(previewBounds),
    sprites: [
      fittedBoot("right-boot", source, screenLeftBounds, screenLeftCuff, 514, 483, 1212),
      fittedBoot("left-boot", source, screenRightBounds, screenRightCuff, 740, 777, 1213),
    ],
  };
}

function fittedBoot(
  id: string,
  source: ImageSourcePropType,
  bounds: ArtworkBounds,
  [cuffLeft, cuffRight, cuffY]: readonly [number, number, number],
  shinX: number,
  soleX: number,
  groundY: number,
): CharacterSpriteDefinition {
  const crop = artworkCrop(bounds);
  const scaleX = 110 / (cuffRight - cuffLeft);
  const width = crop.width * scaleX;
  const height = 280;
  const destination = { x: soleX - width / 2, y: groundY - height, width, height };
  const y = destination.y + (cuffY - crop.y) * height / crop.height;
  const unleanedCuffX = destination.x + ((cuffLeft + cuffRight) / 2 - crop.x) * scaleX;
  return {
    id, layer: "boots", source,
    frame: { crop, destination, shearX: (shinX - unleanedCuffX) / (y - groundY) },
    bootCuff: { x: shinX, y, width: 110 },
  };
}

/**
 * Previews use tightly cropped art or explicit previewCrop bounds. Character
 * sprites use the shared canvas, with source artwork placed by an optional frame.
 */
const COSMETIC_ASSETS: Record<string, CosmeticAssetDefinition> = {
  "avatar-v2/backgrounds/celestial-citadel": {
    slot: "scene",
    previewSource: CELESTIAL_CITADEL_BACKGROUND,
    sceneSource: CELESTIAL_CITADEL_BACKGROUND,
  },
  "avatar-v2/backgrounds/sunset-harbor": {
    slot: "scene",
    previewSource: SUNSET_HARBOR_BACKGROUND,
    sceneSource: SUNSET_HARBOR_BACKGROUND,
  },
  "avatar-v2/backgrounds/grand-library": {
    slot: "scene",
    previewSource: GRAND_LIBRARY_BACKGROUND,
    sceneSource: GRAND_LIBRARY_BACKGROUND,
  },
  "avatar-v2/backgrounds/festival-market": {
    slot: "scene",
    previewSource: FESTIVAL_MARKET_BACKGROUND,
    sceneSource: FESTIVAL_MARKET_BACKGROUND,
  },
  "avatar-v2/backgrounds/desert-oasis": {
    slot: "scene",
    previewSource: DESERT_OASIS_BACKGROUND,
    sceneSource: DESERT_OASIS_BACKGROUND,
  },
  "avatar-v2/backgrounds/snowy-village": {
    slot: "scene",
    previewSource: SNOWY_VILLAGE_BACKGROUND,
    sceneSource: SNOWY_VILLAGE_BACKGROUND,
  },
  "avatar-v2/backgrounds/crystal-cavern": {
    slot: "scene",
    previewSource: CRYSTAL_CAVERN_BACKGROUND,
    sceneSource: CRYSTAL_CAVERN_BACKGROUND,
  },
  "avatar-v2/backgrounds/royal-training-yard": {
    slot: "scene",
    previewSource: ROYAL_TRAINING_YARD_BACKGROUND,
    sceneSource: ROYAL_TRAINING_YARD_BACKGROUND,
  },
  "avatar-v2/backgrounds/castle-garden": {
    slot: "scene",
    previewSource: CASTLE_GARDEN_BACKGROUND,
    sceneSource: CASTLE_GARDEN_BACKGROUND,
  },
  "avatar-v2/backgrounds/moonlit-glade": {
    slot: "scene",
    previewSource: MOONLIT_GLADE_BACKGROUND,
    sceneSource: MOONLIT_GLADE_BACKGROUND,
  },
  "avatar-v2/pets/sky-griffin": {
    slot: "pet",
    previewSource: SKY_GRIFFIN_PET,
    sceneSource: SKY_GRIFFIN_PET,
  },
  "avatar-v2/pets/moss-golem": {
    slot: "pet",
    previewSource: MOSS_GOLEM_PET,
    sceneSource: MOSS_GOLEM_PET,
  },
  "avatar-v2/pets/starlight-cat": {
    slot: "pet",
    previewSource: STARLIGHT_CAT_PET,
    sceneSource: STARLIGHT_CAT_PET,
  },
  "avatar-v2/pets/tide-turtle": {
    slot: "pet",
    previewSource: TIDE_TURTLE_PET,
    sceneSource: TIDE_TURTLE_PET,
  },
  "avatar-v2/pets/crystal-hare": {
    slot: "pet",
    previewSource: CRYSTAL_HARE_PET,
    sceneSource: CRYSTAL_HARE_PET,
  },
  "avatar-v2/pets/ember-drake": {
    slot: "pet",
    previewSource: EMBER_DRAKE_PET,
    sceneSource: EMBER_DRAKE_PET,
  },
  "avatar-v2/pets/cloud-ram": {
    slot: "pet",
    previewSource: CLOUD_RAM_PET,
    sceneSource: CLOUD_RAM_PET,
  },
  "avatar-v2/pets/scholar-owl": {
    slot: "pet",
    previewSource: SCHOLAR_OWL_PET,
    sceneSource: SCHOLAR_OWL_PET,
  },
  "avatar-v2/pets/sunfire-fox": {
    slot: "pet",
    previewSource: SUNFIRE_FOX_PET,
    sceneSource: SUNFIRE_FOX_PET,
  },
  "avatar-v2/pets/verdant-drake": {
    slot: "pet",
    previewSource: VERDANT_DRAKE_PET,
    sceneSource: VERDANT_DRAKE_PET,
  },
  "avatar-v2/auras/prismatic-radiance": {
    slot: "aura",
    previewSource: PRISMATIC_RADIANCE_AURA,
    sceneSource: PRISMATIC_RADIANCE_AURA,
  },
  "avatar-v2/auras/heartbloom": {
    slot: "aura",
    previewSource: HEARTBLOOM_AURA,
    sceneSource: HEARTBLOOM_AURA,
  },
  "avatar-v2/auras/crystal-halo": {
    slot: "aura",
    previewSource: CRYSTAL_HALO_AURA,
    sceneSource: CRYSTAL_HALO_AURA,
  },
  "avatar-v2/auras/tempest-surge": {
    slot: "aura",
    previewSource: TEMPEST_SURGE_AURA,
    sceneSource: TEMPEST_SURGE_AURA,
  },
  "avatar-v2/auras/astral-vortex": {
    slot: "aura",
    previewSource: ASTRAL_VORTEX_AURA,
    sceneSource: ASTRAL_VORTEX_AURA,
  },
  "avatar-v2/auras/seraphic-light": {
    slot: "aura",
    previewSource: SERAPHIC_LIGHT_AURA,
    sceneSource: SERAPHIC_LIGHT_AURA,
  },
  "avatar-v2/auras/frostveil": {
    slot: "aura",
    previewSource: FROSTVEIL_AURA,
    sceneSource: FROSTVEIL_AURA,
  },
  "avatar-v2/auras/phoenix-flame": {
    slot: "aura",
    previewSource: PHOENIX_FLAME_AURA,
    sceneSource: PHOENIX_FLAME_AURA,
  },
  "avatar-v2/auras/verdant-wisps": {
    slot: "aura",
    previewSource: VERDANT_WISPS_AURA,
    sceneSource: VERDANT_WISPS_AURA,
  },
  "avatar-v2/auras/arcane-constellation": {
    slot: "aura",
    previewSource: ARCANE_CONSTELLATION_AURA,
    sceneSource: ARCANE_CONSTELLATION_AURA,
  },
  "avatar-v2/hair/windblown-layers": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/windblown-layers.png"),
    sprites: layeredHair(WINDBLOWN_LAYERS_HAIR),
  },
  "avatar-v2/hair/side-swept-layers": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/side-swept-layers.png"),
    sprites: layeredHair(SIDE_SWEPT_LAYERS_HAIR),
  },
  "avatar-v2/hair/spring-curls": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/spring-curls.png"),
    sprites: layeredHair(SPRING_CURLS_HAIR),
  },
  "avatar-v2/hair/skyward-spikes": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/skyward-spikes.png"),
    sprites: layeredHair(SKYWARD_SPIKES_HAIR),
  },
  "avatar-v2/hair/tousled-layers": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/tousled-layers.png"),
    sprites: layeredHair(TOUSLED_LAYERS_HAIR),
  },
  "avatar-v2/hair/curtain-bob": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/curtain-bob.png"),
    sprites: [sprite("front", "hairFront", CURTAIN_BOB_HAIR)],
  },
  "avatar-v2/hair/high-ponytail": framedHair(
    require("../../assets/avatar/v2/hair/high-ponytail.png"), [198, 46, 1143, 1209],
    [577, 680], [0.33, 0.285], [627, 187], true),
  "avatar-v2/hair/twin-braids": framedHair(
    require("../../assets/avatar/v2/hair/twin-braids.png"), [269, 54, 990, 1196],
    [630, 548], [0.354, 0.34], [627, 188]),
  "avatar-v2/hair/feathered-sweep": {
    slot: "hair",
    previewSource: require("../../assets/avatar/v2/hair/feathered-sweep.png"),
    sprites: layeredHair(FEATHERED_SWEEP_HAIR),
  },
  "avatar-v2/hair/long-shag": framedHair(
    require("../../assets/avatar/v2/hair/long-shag.png"), [179, 65, 1072, 1168],
    [630, 700], [0.30, 0.255], [627, 188]),
  "avatar-v2/hats/azure-feather-cap": {
    slot: "head",
    previewSource: require("../../assets/avatar/v2/hats/azure-feather-cap.png"),
    sprites: [sprite("headwear", "headwear", AZURE_FEATHER_CAP)],
  },
  "avatar-v2/hats/starlight-hat": hatAsset(
    require("../../assets/avatar/v2/hats/starlight-hat.png"), [45, 90, 1248, 1100], 575),
  "avatar-v2/hats/royal-vanguard-hat": hatAsset(
    require("../../assets/avatar/v2/hats/royal-vanguard-hat.png"), [51, 148, 1204, 933], 454),
  "avatar-v2/hats/crimson-guard-hat": hatAsset(
    require("../../assets/avatar/v2/hats/crimson-guard-hat.png"), [79, 146, 1180, 1063], 590),
  "avatar-v2/hats/frostbound-hat": hatAsset(
    require("../../assets/avatar/v2/hats/frostbound-hat.png"), [84, 63, 1170, 1091], 380, "hood"),
  "avatar-v2/hats/forest-ranger-hat": hatAsset(
    require("../../assets/avatar/v2/hats/forest-ranger-hat.png"), [69, 221, 1185, 936], 676),
  "avatar-v2/hats/teal-wayfarer-hat": hatAsset(
    require("../../assets/avatar/v2/hats/teal-wayfarer-hat.png"), [122, 57, 1148, 1198], 370),
  "avatar-v2/hats/harbor-scout-hat": hatAsset(
    require("../../assets/avatar/v2/hats/harbor-scout-hat.png"), [46, 170, 1209, 1050], 580),
  "avatar-v2/hats/verdant-warden-hat": hatAsset(
    require("../../assets/avatar/v2/hats/verdant-warden-hat.png"), [79, 102, 1180, 1089], 373),
  "avatar-v2/hats/celestial-acolyte-hat": hatAsset(
    require("../../assets/avatar/v2/hats/celestial-acolyte-hat.png"), [49, 81, 1204, 1135], 426, "circlet"),
  "avatar-v2/hats/royal-bard-hat": hatAsset(
    require("../../assets/avatar/v2/hats/royal-bard-hat.png"), [90, 151, 1234, 1118], 485),
  "avatar-v2/tops/guild-tunic": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/guild-tunic.png"),
    sprites: GUILD_TUNIC_SPRITES,
  },
  "avatar-v2/dresses/starlight": dressAsset(
    require("../../assets/avatar/v2/dresses/starlight.png"), [96, 114, 990, 1291], 218, 614),
  "avatar-v2/dresses/forest-ranger": dressAsset(
    require("../../assets/avatar/v2/dresses/forest-ranger.png"), [57, 100, 1027, 1348], 209, 646),
  "avatar-v2/dresses/frostbound": dressAsset(
    require("../../assets/avatar/v2/dresses/frostbound.png"), [49, 101, 1039, 1348], 219, 605),
  "avatar-v2/dresses/teal-wayfarer": dressAsset(
    require("../../assets/avatar/v2/dresses/teal-wayfarer.png"), [76, 83, 1010, 1302], 193, 562),
  "avatar-v2/dresses/crimson-guard": dressAsset(
    require("../../assets/avatar/v2/dresses/crimson-guard.png"), [42, 68, 1044, 1385], 177, 617),
  "avatar-v2/dresses/royal-vanguard": dressAsset(
    require("../../assets/avatar/v2/dresses/royal-vanguard.png"), [70, 80, 1016, 1312], 203, 601),
  "avatar-v2/dresses/royal-bard": dressAsset(
    require("../../assets/avatar/v2/dresses/royal-bard.png"), [46, 100, 1042, 1292], 207, 612),
  "avatar-v2/dresses/harbor-scout": dressAsset(
    require("../../assets/avatar/v2/dresses/harbor-scout.png"), [39, 96, 1048, 1328], 205, 597),
  "avatar-v2/dresses/verdant-warden": dressAsset(
    require("../../assets/avatar/v2/dresses/verdant-warden.png"), [65, 111, 1022, 1340], 220, 589),
  "avatar-v2/dresses/celestial-acolyte": dressAsset(
    require("../../assets/avatar/v2/dresses/celestial-acolyte.png"), [81, 93, 1005, 1321], 202, 560),
  "avatar-v2/tops/midnight-vanguard": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/midnight-vanguard.png"),
    sprites: [sprite("tunic", "upperBody", MIDNIGHT_VANGUARD_TUNIC)],
  },
  "avatar-v2/tops/royal-bloom": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/royal-bloom.png"),
    sprites: [sprite("tunic", "upperBody", ROYAL_BLOOM_TUNIC)],
  },
  "avatar-v2/tops/celestial-acolyte": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/celestial-acolyte.png"),
    sprites: [sprite("tunic", "upperBody", CELESTIAL_ACOLYTE_TUNIC)],
  },
  "avatar-v2/tops/harbor-scout": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/harbor-scout.png"),
    sprites: [sprite("tunic", "upperBody", HARBOR_SCOUT_TUNIC)],
  },
  "avatar-v2/tops/verdant-warden": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/verdant-warden.png"),
    sprites: [sprite("tunic", "upperBody", VERDANT_WARDEN_TUNIC)],
  },
  "avatar-v2/tops/frostbound-vest": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/frostbound-vest.png"),
    sprites: [sprite("tunic", "upperBody", FROSTBOUND_VEST_TUNIC)],
  },
  "avatar-v2/tops/teal-wayfarer": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/teal-wayfarer.png"),
    sprites: [sprite("tunic", "upperBody", TEAL_WAYFARER_TUNIC)],
  },
  "avatar-v2/tops/star-captain": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/star-captain.png"),
    sprites: [sprite("tunic", "upperBody", STAR_CAPTAIN_TUNIC)],
  },
  "avatar-v2/tops/crimson-guard": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/crimson-guard.png"),
    sprites: [sprite("tunic", "upperBody", CRIMSON_GUARD_TUNIC)],
  },
  "avatar-v2/tops/forest-ranger": {
    slot: "upperBody",
    previewSource: require("../../assets/avatar/v2/tops/forest-ranger.png"),
    sprites: [sprite("tunic", "upperBody", FOREST_RANGER_TUNIC)],
  },
  "avatar-v2/bottoms/traveler-trousers": {
    slot: "bottoms",
    previewSource: require("../../assets/avatar/v2/bottoms/traveler-trousers.png"),
    sprites: TRAVELER_TROUSERS_SPRITES,
  },
  "avatar-v2/bottoms/starlight-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/starlight-trousers.png"), [320, 209, 933, 1056], [508.7, 130, 744.3, 130.7]),
  "avatar-v2/bottoms/forest-ranger-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/forest-ranger-trousers.png"), [351, 175, 904, 1056], [512.6, 113.1, 743, 111.2]),
  "avatar-v2/bottoms/frostbound-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/frostbound-trousers.png"), [331, 213, 926, 1058], [507.7, 121.5, 746.6, 123.5]),
  "avatar-v2/bottoms/teal-wayfarer-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/teal-wayfarer-trousers.png"), [313, 233, 945, 1033], [504.8, 158.6, 749.5, 158]),
  "avatar-v2/bottoms/crimson-guard-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/crimson-guard-trousers.png"), [322, 211, 933, 1075], [507.1, 130.7, 746.9, 132]),
  "avatar-v2/bottoms/royal-vanguard-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/royal-vanguard-trousers.png"), [344, 237, 910, 1117], [505.1, 115, 749.2, 115.7]),
  "avatar-v2/bottoms/royal-bard-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/royal-bard-trousers.png"), [324, 225, 934, 1070], [510.3, 138.5, 746, 140.4]),
  "avatar-v2/bottoms/harbor-scout-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/harbor-scout-trousers.png"), [295, 182, 962, 1036], [495, 152.1, 758.6, 159.2]),
  "avatar-v2/bottoms/verdant-warden-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/verdant-warden-trousers.png"), [312, 197, 943, 1044], [505.1, 133.9, 747.6, 134.6]),
  "avatar-v2/bottoms/celestial-acolyte-trousers": trousersAsset(
    require("../../assets/avatar/v2/bottoms/celestial-acolyte-trousers.png"), [331, 197, 925, 1060], [506.8, 133.9, 748.2, 133.2]),
  "avatar-v2/boots/guild-boots": {
    slot: "boots",
    previewSource: require("../../assets/avatar/v2/boots/guild-boots.png"),
    sprites: GUILD_BOOTS_SPRITES,
  },
  "avatar-v2/boots/starlight-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/starlight-boots.png"),
    [109, 239, 541, 1002], [713, 239, 1146, 1002], [255, 511, 312], [743, 1001, 312]),
  "avatar-v2/boots/forest-ranger-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/forest-ranger-boots.png"),
    [136, 206, 558, 1033], [697, 204, 1119, 1034], [233, 518, 317], [736, 1021, 317]),
  "avatar-v2/boots/frostbound-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/frostbound-boots.png"),
    [73, 233, 545, 1031], [710, 232, 1182, 1031], [227, 505, 327], [750, 1028, 327]),
  "avatar-v2/boots/crimson-guard-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/crimson-guard-boots.png"),
    [100, 270, 527, 989], [727, 270, 1154, 989], [253, 499, 348], [756, 1002, 348]),
  "avatar-v2/boots/teal-wayfarer-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/teal-wayfarer-boots.png"),
    [109, 261, 516, 1022], [739, 262, 1145, 1022], [246, 494, 349], [761, 1009, 349]),
  "avatar-v2/boots/royal-vanguard-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/royal-vanguard-boots.png"),
    [68, 260, 518, 993], [739, 260, 1187, 993], [266, 490, 342], [765, 989, 342]),
  "avatar-v2/boots/harbor-scout-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/harbor-scout-boots.png"),
    [119, 299, 541, 983], [715, 299, 1135, 983], [264, 514, 375], [741, 991, 375]),
  "avatar-v2/boots/royal-bard-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/royal-bard-boots.png"),
    [82, 277, 530, 979], [725, 277, 1172, 979], [243, 500, 354], [755, 1012, 354]),
  "avatar-v2/boots/verdant-warden-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/verdant-warden-boots.png"),
    [115, 304, 518, 982], [736, 304, 1140, 982], [258, 485, 389], [770, 997, 389]),
  "avatar-v2/boots/celestial-acolyte-boots": bootsAsset(
    require("../../assets/avatar/v2/boots/celestial-acolyte-boots.png"),
    [121, 204, 582, 1027], [669, 204, 1130, 1027], [280, 551, 309], [704, 975, 309]),
};

export const DEFAULT_CHARACTER_SPRITES = [
  ...(COSMETIC_ASSETS["avatar-v2/hair/windblown-layers"].sprites ?? []),
  ...TRAVELER_TROUSERS_SPRITES,
  ...GUILD_BOOTS_SPRITES,
  ...GUILD_TUNIC_SPRITES,
] satisfies CharacterSpriteSet;

const ADVENTURER_BODY_SPRITES = [
  { id: "left-leg", source: BODY_LEFT_LEG, region: "upperLegLeft", layer: "bodyBack" },
  { id: "right-leg", source: BODY_RIGHT_LEG, region: "upperLegRight", layer: "bodyBack" },
  { id: "torso", source: BODY_TORSO, region: "torso", layer: "baseBody" },
  { id: "left-arm", source: BODY_LEFT_ARM, region: "upperArmLeft", layer: "bodyBack" },
  { id: "right-arm", source: BODY_RIGHT_ARM, region: "upperArmRight", layer: "bodyBack" },
  { id: "neck", source: BODY_NECK, region: "neck", layer: "baseBody" },
  { id: "head", source: BODY_HEAD, region: "head", layer: "bodyFront" },
] satisfies readonly BaseBodySpriteDefinition[];

// Both rigs use the same shoulders, ear line, waist, and ground anchors so every
// cosmetic remains available on either body. Keep the supplied source PNGs intact.
const GIRL_HEAD = require("../../assets/avatar/v2/body-girl/head.png");
const GIRL_BODY_SPRITES = [
  { id: "left-leg", region: "upperLegLeft", layer: "bodyBack",
    source: require("../../assets/avatar/v2/body-girl/left-leg.png"),
    frame: sourceFrame([1024, 1536], [397, 82, 739, 1435], [597.8, 584.15, 205.2, 623.5], girlSilhouettes["left-leg"], -0.02) },
  { id: "right-leg", region: "upperLegRight", layer: "bodyBack",
    source: require("../../assets/avatar/v2/body-girl/right-leg.png"),
    frame: sourceFrame([1024, 1536], [381, 47, 642, 1397], [465, 584.15, 156.6, 623.5], girlSilhouettes["right-leg"], -0.045) },
  { id: "left-arm", region: "upperArmLeft", layer: "bodyBack",
    source: require("../../assets/avatar/v2/body-girl/left-arm.png"),
    frame: sourceFrame([1024, 1536], [342, 73, 799, 1502], [706.48, 289.975, 155.38, 464.425], girlSilhouettes["left-arm"]) },
  { id: "right-arm", region: "upperArmRight", layer: "bodyBack",
    source: require("../../assets/avatar/v2/body-girl/right-arm.png"),
    frame: sourceFrame([1024, 1536], [283, 73, 682, 1474], [411.82, 289.975, 135.66, 455.325], girlSilhouettes["right-arm"]) },
  { id: "torso", region: "torso", layer: "baseBody",
    source: require("../../assets/avatar/v2/body-girl/torso.png"),
    frame: sourceFrame([1086, 1448], [219, 188, 868, 1294], [490.92, 244.36, 272.58, 453.46]) },
  { id: "neck", region: "neck", layer: "bodyBack", source: GIRL_HEAD,
    frame: sourceFrame([1254, 1254], [200, 992, 1050, 1159], [520.75, 265.16, 212.5, 55.67]) },
  { id: "head", region: "head", layer: "bodyFront", source: GIRL_HEAD,
    frame: sourceFrame([1254, 1254], [200, 615, 1050, 995], [520.75, 160, 212.5, 106]) },
  { id: "crown", region: "head", layer: "bodyFront", source: GIRL_HEAD,
    frame: sourceFrame([1254, 1254], [200, 99, 1050, 615.5], [520.75, 38.055, 212.5, 122.085]) },
] satisfies readonly BaseBodySpriteDefinition[];

export const BASE_BODY_SPRITES: Record<
  "BOY" | "GIRL",
  readonly BaseBodySpriteDefinition[]
> = {
  BOY: ADVENTURER_BODY_SPRITES,
  GIRL: GIRL_BODY_SPRITES,
};

const FALLBACK_IMAGES: Partial<
  Record<CosmeticType, Record<number, ImageSourcePropType>>
> = {
};

const FALLBACK_CHARACTER_LAYER: Partial<Record<CosmeticType, CharacterLayer>> = {
  HAIR: "hairFront",
  HAT: "headwear",
  TOP: "upperBody",
  BOTTOM: "bottoms",
  BOOTS: "boots",
  CAPE: "capeBack",
  WEAPON: "weapon",
  SHIELD: "shield",
};

type CosmeticAssetReference = Pick<Cosmetic, "id" | "type"> &
  Partial<Pick<Cosmetic, "imageUrl">>;

export function getCosmeticPreviewSource(cosmetic: CosmeticAssetReference) {
  if (cosmetic.imageUrl && COSMETIC_ASSETS[cosmetic.imageUrl]) {
    return COSMETIC_ASSETS[cosmetic.imageUrl].previewSource;
  }

  return typeof cosmetic.id === "number"
    ? FALLBACK_IMAGES[cosmetic.type]?.[cosmetic.id]
    : undefined;
}

export function getCosmeticPreviewCrop(cosmetic: CosmeticAssetReference) {
  return cosmetic.imageUrl ? COSMETIC_ASSETS[cosmetic.imageUrl]?.previewCrop : undefined;
}

export function getEquippedCharacterSprites(
  cosmetics: Cosmetic[] | undefined,
  cosmeticId: CosmeticId | null | undefined,
  type: CosmeticType,
): ResolvedCharacterSprite[] {
  if (!cosmeticId) return [];

  const cosmetic = cosmetics?.find(
    (candidate) => candidate.id === cosmeticId && candidate.type === type,
  );
  const assetKey = cosmetic?.imageUrl;
  const definition = assetKey ? COSMETIC_ASSETS[assetKey] : undefined;

  if (assetKey && definition?.sprites) {
    return resolveSpriteSet(assetKey, definition.sprites, definition.covers);
  }

  const fallbackSource = typeof cosmeticId === "number"
    ? FALLBACK_IMAGES[type]?.[cosmeticId]
    : undefined;
  const fallbackLayer = FALLBACK_CHARACTER_LAYER[type];
  return fallbackSource && fallbackLayer
    ? [
        {
          key: `fallback:${type}:${cosmeticId}:${fallbackLayer}`,
          layer: fallbackLayer,
          source: fallbackSource,
        },
      ]
    : [];
}

export function getEquippedSceneSource(
  cosmetics: Cosmetic[] | undefined,
  cosmeticId: CosmeticId | null | undefined,
  type: "BACKGROUND" | "PET" | "AURA",
) {
  if (!cosmeticId) return undefined;

  const cosmetic = cosmetics?.find(
    (candidate) => candidate.id === cosmeticId && candidate.type === type,
  );

  if (cosmetic?.imageUrl) {
    const source = COSMETIC_ASSETS[cosmetic.imageUrl]?.sceneSource;
    if (source) return source;
  }

  return typeof cosmeticId === "number"
    ? FALLBACK_IMAGES[type]?.[cosmeticId]
    : undefined;
}

export function resolveSpriteSet(
  assetKey: string,
  sprites: readonly (CharacterSpriteDefinition | BaseBodySpriteDefinition)[],
  covers: readonly BodyRegion[] = [],
): ResolvedCharacterSprite[] {
  return sprites.map((definition) => ({
    key: `${assetKey}:${definition.id}`,
    layer: definition.layer,
    source: definition.source,
    frame: definition.frame,
    bootCuff: definition.bootCuff,
    trouserLegs: definition.trouserLegs,
    hairClip: definition.hairClip,
    headClip: definition.headClip,
    clipPath: definition.clipPath,
    hairPart: definition.hairPart,
    tuckPonytail: definition.tuckPonytail,
    fullOutfit: definition.fullOutfit,
    region: "region" in definition ? definition.region : undefined,
    covers,
  }));
}
