import { useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "expo-router/react-navigation";
import { createBottomTabNavigator } from "expo-router/js-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import ShopContent from "../components/ShopContent";
import LifeButton from "../components/LifeButton";
import LifeCard from "../components/LifeCard";
import { FilterChip, ScreenShell, UiText } from "../components/ui/Primitives";
import { uiTheme as ui } from "../theme/theme";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import type { ShopItem, ShopResponse } from "../types";

// Seed metadata snapshot from backend/seeds/cosmetics.json, October 22, 2026.
// Kept inside the frontend because Metro cannot import outside its project root.
const catalog = [
  {"itemId":"starter_tunic","name":"Starter Tunic","category":"tunic","price":25,"requiredLevel":1,"requiredAchievement":null,"assetKey":"starter-tunic.png"},
  {"itemId":"forest_tunic","name":"Forest Tunic","category":"tunic","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"forest-tunic.png"},
  {"itemId":"forestbound_tunic","name":"Forestbound Tunic","category":"tunic","price":150,"requiredLevel":1,"requiredAchievement":"COMPLETE_25_TASKS","assetKey":"avatar-v2/tops/crimson-guard"},
  {"itemId":"forestbound_dress","name":"Forestbound Dress","category":"tunic","price":150,"requiredLevel":1,"requiredAchievement":"COMPLETE_25_TASKS","assetKey":"avatar-v2/dresses/forest-ranger"},
  {"itemId":"forestbound_cap","name":"Forestbound Cap","category":"hat","price":150,"requiredLevel":1,"requiredAchievement":"COMPLETE_25_TASKS","assetKey":"avatar-v2/hats/forest-ranger-hat"},
  {"itemId":"starweaver_tunic","name":"Starweaver Tunic","category":"tunic","price":300,"requiredLevel":1,"requiredAchievement":"REACH_LEVEL_5","assetKey":"avatar-v2/tops/forest-ranger"},
  {"itemId":"starweaver_dress","name":"Starweaver Dress","category":"tunic","price":300,"requiredLevel":1,"requiredAchievement":"REACH_LEVEL_5","assetKey":"avatar-v2/dresses/starlight"},
  {"itemId":"starweaver_hat","name":"Starweaver Hat","category":"hat","price":300,"requiredLevel":1,"requiredAchievement":"REACH_LEVEL_5","assetKey":"avatar-v2/hats/starlight-hat"},
  {"itemId":"dawnkeeper_tunic","name":"Dawnkeeper Tunic","category":"tunic","price":500,"requiredLevel":1,"requiredAchievement":"COMPLETE_100_TASKS","assetKey":"avatar-v2/tops/midnight-vanguard"},
  {"itemId":"dawnkeeper_dress","name":"Dawnkeeper Dress","category":"tunic","price":500,"requiredLevel":1,"requiredAchievement":"COMPLETE_100_TASKS","assetKey":"avatar-v2/dresses/celestial-acolyte"},
  {"itemId":"dawnkeeper_headpiece","name":"Dawnkeeper Headpiece","category":"hat","price":500,"requiredLevel":1,"requiredAchievement":"COMPLETE_100_TASKS","assetKey":"avatar-v2/hats/celestial-acolyte-hat"},
  {"itemId":"mossling","name":"Mossling","category":"pet","price":200,"requiredLevel":1,"requiredAchievement":"COMPLETE_10_TASKS","assetKey":"avatar-v2/pets/moss-golem"},
  {"itemId":"emberfox","name":"Emberfox","category":"pet","price":400,"requiredLevel":1,"requiredAchievement":"COMPLETE_DAILY_GOAL_7_DAYS","assetKey":"avatar-v2/pets/sunfire-fox"},
  {"itemId":"moonwing","name":"Moonwing","category":"pet","price":600,"requiredLevel":1,"requiredAchievement":"REACH_LEVEL_10","assetKey":"avatar-v2/pets/scholar-owl"},
  {"itemId":"royal_bloom_tunic","name":"Royal Bloom Tunic","category":"tunic","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/tops/royal-bloom"},
  {"itemId":"celestial_acolyte_tunic","name":"Celestial Acolyte Tunic","category":"tunic","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/tops/celestial-acolyte"},
  {"itemId":"harbor_scout_tunic","name":"Harbor Scout Tunic","category":"tunic","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/tops/harbor-scout"},
  {"itemId":"verdant_warden_tunic","name":"Verdant Warden Tunic","category":"tunic","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/tops/verdant-warden"},
  {"itemId":"frostbound_vest","name":"Frostbound Vest","category":"tunic","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/tops/frostbound-vest"},
  {"itemId":"teal_wayfarer_tunic","name":"Teal Wayfarer Tunic","category":"tunic","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/tops/teal-wayfarer"},
  {"itemId":"star_captain_tunic","name":"Star Captain Tunic","category":"tunic","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/tops/star-captain"},
  {"itemId":"frostbound_dress","name":"Frostbound Dress","category":"tunic","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/frostbound"},
  {"itemId":"teal_wayfarer_dress","name":"Teal Wayfarer Dress","category":"tunic","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/teal-wayfarer"},
  {"itemId":"crimson_guard_dress","name":"Crimson Guard Dress","category":"tunic","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/crimson-guard"},
  {"itemId":"royal_vanguard_dress","name":"Royal Vanguard Dress","category":"tunic","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/royal-vanguard"},
  {"itemId":"royal_bard_dress","name":"Royal Bard Dress","category":"tunic","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/royal-bard"},
  {"itemId":"harbor_scout_dress","name":"Harbor Scout Dress","category":"tunic","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/harbor-scout"},
  {"itemId":"verdant_warden_dress","name":"Verdant Warden Dress","category":"tunic","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/verdant-warden"},
  {"itemId":"traveler_trousers","name":"Traveler Trousers","category":"pants","price":50,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/traveler-trousers"},
  {"itemId":"starlight_trousers","name":"Starlight Trousers","category":"pants","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/starlight-trousers"},
  {"itemId":"forest_ranger_trousers","name":"Forest Ranger Trousers","category":"pants","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/forest-ranger-trousers"},
  {"itemId":"frostbound_trousers","name":"Frostbound Trousers","category":"pants","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/frostbound-trousers"},
  {"itemId":"teal_wayfarer_trousers","name":"Teal Wayfarer Trousers","category":"pants","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/teal-wayfarer-trousers"},
  {"itemId":"crimson_guard_trousers","name":"Crimson Guard Trousers","category":"pants","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/crimson-guard-trousers"},
  {"itemId":"royal_vanguard_trousers","name":"Royal Vanguard Trousers","category":"pants","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/royal-vanguard-trousers"},
  {"itemId":"royal_bard_trousers","name":"Royal Bard Trousers","category":"pants","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/royal-bard-trousers"},
  {"itemId":"harbor_scout_trousers","name":"Harbor Scout Trousers","category":"pants","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/harbor-scout-trousers"},
  {"itemId":"verdant_warden_trousers","name":"Verdant Warden Trousers","category":"pants","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/verdant-warden-trousers"},
  {"itemId":"celestial_acolyte_trousers","name":"Celestial Acolyte Trousers","category":"pants","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/celestial-acolyte-trousers"},
  {"itemId":"guild_boots","name":"Guild Boots","category":"boots","price":50,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/guild-boots"},
  {"itemId":"starlight_boots","name":"Starlight Boots","category":"boots","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/boots/starlight-boots"},
  {"itemId":"forest_ranger_boots","name":"Forest Ranger Boots","category":"boots","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/boots/forest-ranger-boots"},
  {"itemId":"frostbound_boots","name":"Frostbound Boots","category":"boots","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/boots/frostbound-boots"},
  {"itemId":"crimson_guard_boots","name":"Crimson Guard Boots","category":"boots","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/boots/crimson-guard-boots"},
  {"itemId":"teal_wayfarer_boots","name":"Teal Wayfarer Boots","category":"boots","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/boots/teal-wayfarer-boots"},
  {"itemId":"royal_vanguard_boots","name":"Royal Vanguard Boots","category":"boots","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/boots/royal-vanguard-boots"},
  {"itemId":"harbor_scout_boots","name":"Harbor Scout Boots","category":"boots","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/boots/harbor-scout-boots"},
  {"itemId":"royal_bard_boots","name":"Royal Bard Boots","category":"boots","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/boots/royal-bard-boots"},
  {"itemId":"verdant_warden_boots","name":"Verdant Warden Boots","category":"boots","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/boots/verdant-warden-boots"},
  {"itemId":"celestial_acolyte_boots","name":"Celestial Acolyte Boots","category":"boots","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/boots/celestial-acolyte-boots"},
  {"itemId":"azure_feather_cap","name":"Azure Feather Cap","category":"hat","price":50,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/azure-feather-cap"},
  {"itemId":"royal_vanguard_hat","name":"Royal Vanguard Hat","category":"hat","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/hats/royal-vanguard-hat"},
  {"itemId":"crimson_guard_hat","name":"Crimson Guard Hat","category":"hat","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/hats/crimson-guard-hat"},
  {"itemId":"frostbound_hat","name":"Frostbound Hat","category":"hat","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/hats/frostbound-hat"},
  {"itemId":"teal_wayfarer_hat","name":"Teal Wayfarer Hat","category":"hat","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/hats/teal-wayfarer-hat"},
  {"itemId":"harbor_scout_hat","name":"Harbor Scout Hat","category":"hat","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/hats/harbor-scout-hat"},
  {"itemId":"verdant_warden_hat","name":"Verdant Warden Hat","category":"hat","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/hats/verdant-warden-hat"},
  {"itemId":"royal_bard_hat","name":"Royal Bard Hat","category":"hat","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/hats/royal-bard-hat"},
  {"itemId":"sky_griffin","name":"Sky Griffin","category":"pet","price":450,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/pets/sky-griffin"},
  {"itemId":"starlight_cat","name":"Starlight Cat","category":"pet","price":200,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/pets/starlight-cat"},
  {"itemId":"tide_turtle","name":"Tide Turtle","category":"pet","price":250,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/pets/tide-turtle"},
  {"itemId":"crystal_hare","name":"Crystal Hare","category":"pet","price":300,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/pets/crystal-hare"},
  {"itemId":"ember_drake","name":"Ember Drake","category":"pet","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/pets/ember-drake"},
  {"itemId":"cloud_ram","name":"Cloud Ram","category":"pet","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/pets/cloud-ram"},
  {"itemId":"verdant_drake","name":"Verdant Drake","category":"pet","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/pets/verdant-drake"},
  {"itemId":"prismatic_radiance","name":"Prismatic Radiance","category":"aura","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/auras/prismatic-radiance"},
  {"itemId":"heartbloom","name":"Heartbloom","category":"aura","price":200,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/auras/heartbloom"},
  {"itemId":"crystal_halo","name":"Crystal Halo","category":"aura","price":250,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/auras/crystal-halo"},
  {"itemId":"tempest_surge","name":"Tempest Surge","category":"aura","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/auras/tempest-surge"},
  {"itemId":"astral_vortex","name":"Astral Vortex","category":"aura","price":550,"requiredLevel":9,"requiredAchievement":null,"assetKey":"avatar-v2/auras/astral-vortex"},
  {"itemId":"seraphic_light","name":"Seraphic Light","category":"aura","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/auras/seraphic-light"},
  {"itemId":"frostveil","name":"Frostveil","category":"aura","price":350,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/auras/frostveil"},
  {"itemId":"phoenix_flame","name":"Phoenix Flame","category":"aura","price":700,"requiredLevel":11,"requiredAchievement":null,"assetKey":"avatar-v2/auras/phoenix-flame"},
  {"itemId":"verdant_wisps","name":"Verdant Wisps","category":"aura","price":300,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/auras/verdant-wisps"},
  {"itemId":"arcane_constellation","name":"Arcane Constellation","category":"aura","price":800,"requiredLevel":12,"requiredAchievement":null,"assetKey":"avatar-v2/auras/arcane-constellation"},
  {"itemId":"celestial_citadel","name":"Celestial Citadel","category":"background","price":600,"requiredLevel":10,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/celestial-citadel"},
  {"itemId":"sunset_harbor","name":"Sunset Harbor","category":"background","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/sunset-harbor"},
  {"itemId":"grand_library","name":"Grand Library","category":"background","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/grand-library"},
  {"itemId":"festival_market","name":"Festival Market","category":"background","price":100,"requiredLevel":2,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/festival-market"},
  {"itemId":"desert_oasis","name":"Desert Oasis","category":"background","price":250,"requiredLevel":5,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/desert-oasis"},
  {"itemId":"snowy_village","name":"Snowy Village","category":"background","price":300,"requiredLevel":6,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/snowy-village"},
  {"itemId":"crystal_cavern","name":"Crystal Cavern","category":"background","price":400,"requiredLevel":7,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/crystal-cavern"},
  {"itemId":"royal_training_yard","name":"Royal Training Yard","category":"background","price":200,"requiredLevel":4,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/royal-training-yard"},
  {"itemId":"castle_garden","name":"Castle Garden","category":"background","price":150,"requiredLevel":3,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/castle-garden"},
  {"itemId":"moonlit_glade","name":"Moonlit Glade","category":"background","price":500,"requiredLevel":8,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/moonlit-glade"},
  {"itemId":"premium_rose_bard_tunic","name":"Rose Bard Tunic","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/tops/premium-rose-bard-tunic","requiresPremium":true},
  {"itemId":"premium_verdant_sovereign_tunic","name":"Verdant Sovereign Tunic","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/tops/premium-verdant-sovereign-tunic","requiresPremium":true},
  {"itemId":"premium_celestial_regent_tunic","name":"Celestial Regent Tunic","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/tops/premium-celestial-regent-tunic","requiresPremium":true},
  {"itemId":"premium_dawnfire_sovereign_tunic","name":"Dawnfire Sovereign Tunic","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/tops/premium-dawnfire-sovereign-tunic","requiresPremium":true},
  {"itemId":"premium_royal_wayfinder_tunic","name":"Royal Wayfinder Tunic","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/tops/premium-royal-wayfinder-tunic","requiresPremium":true},
  {"itemId":"premium_rose_bard_dress","name":"Rose Bard Dress","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/premium-rose-bard-dress","requiresPremium":true},
  {"itemId":"premium_verdant_sovereign_dress","name":"Verdant Sovereign Dress","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/premium-verdant-sovereign-dress","requiresPremium":true},
  {"itemId":"premium_celestial_regent_dress","name":"Celestial Regent Dress","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/premium-celestial-regent-dress","requiresPremium":true},
  {"itemId":"premium_dawnfire_sovereign_dress","name":"Dawnfire Sovereign Dress","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/premium-dawnfire-sovereign-dress","requiresPremium":true},
  {"itemId":"premium_royal_wayfinder_dress","name":"Royal Wayfinder Dress","category":"tunic","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/dresses/premium-royal-wayfinder-dress","requiresPremium":true},
  {"itemId":"premium_rose_bard_trousers","name":"Rose Bard Trousers","category":"pants","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/premium-rose-bard-trousers","requiresPremium":true},
  {"itemId":"premium_verdant_sovereign_trousers","name":"Verdant Sovereign Trousers","category":"pants","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/premium-verdant-sovereign-trousers","requiresPremium":true},
  {"itemId":"premium_celestial_regent_trousers","name":"Celestial Regent Trousers","category":"pants","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/premium-celestial-regent-trousers","requiresPremium":true},
  {"itemId":"premium_dawnfire_sovereign_trousers","name":"Dawnfire Sovereign Trousers","category":"pants","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/premium-dawnfire-sovereign-trousers","requiresPremium":true},
  {"itemId":"premium_royal_wayfinder_trousers","name":"Royal Wayfinder Trousers","category":"pants","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/bottoms/premium-royal-wayfinder-trousers","requiresPremium":true},
  {"itemId":"premium_rose_bard_hat","name":"Rose Bard Hat","category":"hat","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/premium-rose-bard-hat","requiresPremium":true},
  {"itemId":"premium_verdant_sovereign_hat","name":"Verdant Sovereign Hat","category":"hat","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/premium-verdant-sovereign-hat","requiresPremium":true},
  {"itemId":"premium_celestial_regent_hat","name":"Celestial Regent Hat","category":"hat","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/premium-celestial-regent-hat","requiresPremium":true},
  {"itemId":"premium_dawnfire_sovereign_hat","name":"Dawnfire Sovereign Hat","category":"hat","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/premium-dawnfire-sovereign-hat","requiresPremium":true},
  {"itemId":"premium_royal_wayfinder_hat","name":"Royal Wayfinder Hat","category":"hat","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/hats/premium-royal-wayfinder-hat","requiresPremium":true},
  {"itemId":"premium_rose_bard_boots","name":"Rose Bard Boots","category":"boots","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/premium-rose-bard-boots","requiresPremium":true},
  {"itemId":"premium_verdant_sovereign_boots","name":"Verdant Sovereign Boots","category":"boots","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/premium-verdant-sovereign-boots","requiresPremium":true},
  {"itemId":"premium_celestial_regent_boots","name":"Celestial Regent Boots","category":"boots","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/premium-celestial-regent-boots","requiresPremium":true},
  {"itemId":"premium_dawnfire_sovereign_boots","name":"Dawnfire Sovereign Boots","category":"boots","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/premium-dawnfire-sovereign-boots","requiresPremium":true},
  {"itemId":"premium_royal_wayfinder_boots","name":"Royal Wayfinder Boots","category":"boots","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/boots/premium-royal-wayfinder-boots","requiresPremium":true},
  {"itemId":"premium_rose_palace","name":"Rose Palace","category":"background","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/premium-rose-palace","requiresPremium":true},
  {"itemId":"premium_aurora_springs","name":"Aurora Springs","category":"background","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/premium-aurora-springs","requiresPremium":true},
  {"itemId":"premium_starwatch_terrace","name":"Starwatch Terrace","category":"background","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/backgrounds/premium-starwatch-terrace","requiresPremium":true},
  {"itemId":"premium_astral_clockwork","name":"Astral Clockwork","category":"aura","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/auras/premium-astral-clockwork","requiresPremium":true},
  {"itemId":"premium_lunar_veil","name":"Lunar Veil","category":"aura","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/auras/premium-lunar-veil","requiresPremium":true},
  {"itemId":"premium_prismatic_crown","name":"Prismatic Crown","category":"aura","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/auras/premium-prismatic-crown","requiresPremium":true},
  {"itemId":"premium_mooncrystal_fawn","name":"Mooncrystal Fawn","category":"pet","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/pets/premium-mooncrystal-fawn","requiresPremium":true},
  {"itemId":"premium_lotus_otter","name":"Lotus Otter","category":"pet","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/pets/premium-lotus-otter","requiresPremium":true},
  {"itemId":"premium_starlight_moth","name":"Starlight Moth","category":"pet","price":0,"requiredLevel":1,"requiredAchievement":null,"assetKey":"avatar-v2/pets/premium-starlight-moth","requiresPremium":true},
];

// Actual seed products/art, explicit fixture states. No account, purchase, billing or ad requests.
const items: ShopItem[] = catalog.map((record, index) => ({
  ...record, effectivePrice: record.price, effectiveRequiredLevel: record.requiredLevel,
  owned: index === 0, unlocked: !("requiresPremium" in record && record.requiresPremium) && index !== 2 && index !== 3, canAfford: index !== 1,
  canPurchase: index > 3 && !("requiresPremium" in record && record.requiresPremium), status: index === 0 ? "OWNED" : index === 1 ? "NOT_ENOUGH_COINS" : index < 4 || ("requiresPremium" in record && record.requiresPremium) ? "LOCKED" : "PURCHASABLE",
  requiresPremium: "requiresPremium" in record && record.requiresPremium === true, premiumRequirementSatisfied: !("requiresPremium" in record && record.requiresPremium),
  requirementSatisfied: index !== 2,
  achievementRequirement: index === 2 ? { achievementId: "COMPLETE_25_TASKS", name: "Forestbound", description: "Complete 25 tasks.",
    type: "TASKS_COMPLETED", currentValue: 12, requiredValue: 25, progressPercent: 48, satisfied: false } : null,
}));
const original: ShopResponse = { player: { coins: 284, level: 6 }, items };
function PreviewShop() {
  const [mode, setMode] = useState(Platform.OS === "web" && new URLSearchParams(window.location.search).get("plan") === "premium" ? "Premium" : "Free"), [controls, setControls] = useState(true);
  const [shop, setShop] = useState(original), [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState(""), [purchaseError, setPurchaseError] = useState("");
  const premium = mode === "Premium", unknown = mode === "Plan loading";
  const current = mode === "Empty" ? { ...shop, items: [] } : mode === "Large balance" ? { ...shop, player: { ...shop.player, coins: 1234567890 } }
    : premium ? { ...shop, items: shop.items.map(item => item.requiresPremium && !item.owned
      ? { ...item, premiumRequirementSatisfied: true, canPurchase: true, unlocked: true, status: "PURCHASABLE" as const } : item) } : shop;
  function purchase(item: ShopItem) {
    if (mode === "Purchase failure") { setPurchaseError("Could not purchase this item. Your balance has not changed."); return; }
    setBusyId(item.itemId); setPurchaseError("");
    // Simulate a server snapshot, without calculating a price or issuing a transaction.
    setTimeout(() => {
      setShop(value => ({ ...value, player: { ...value.player, coins: 177 }, items: value.items.map(row => row.itemId === item.itemId
        ? { ...row, owned: true, canPurchase: false, status: "OWNED" } : row) }));
      setBusyId(null); setNotice("Preview server snapshot received. No real purchase.");
    }, 800);
  }
  return <View style={{ flex: 1, backgroundColor: ui.colors.background }}>
    <View testID="shop-review-controls" style={{ padding: ui.spacing.sm, gap: ui.spacing.sm, borderBottomWidth: 1, borderBottomColor: ui.colors.border }}>
      <UiText variant="caption">DEV Shop review · seed catalog + fixture states · no account or ad requests</UiText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs }}>
        {controls && ["Free", "Premium", "Plan loading", "Loading", "Error", "Empty", "Purchase failure", "Large balance"].map(label =>
          <FilterChip key={label} label={label} selected={mode === label} onPress={() => { setMode(label); setPurchaseError(""); }} />)}
        <FilterChip label={controls ? "Hide review controls" : "Show review controls"} onPress={() => setControls(value => !value)} />
      </View>
      {!!notice && <UiText variant="caption" accessibilityLiveRegion="polite">{notice}</UiText>}
    </View>
    <View testID="shop-review" style={{ flex: 1 }}><ShopContent shop={mode === "Loading" ? null : current}
      loading={mode === "Loading"} busyId={busyId} entitlement={{ loading: unknown, premium }}
      loadError={mode === "Error" ? "Could not refresh the shop. Showing the last saved catalog." : ""}
      purchaseError={purchaseError} onPurchase={purchase} onRetry={() => setMode("Free")}
      onPremium={() => setNotice("View Premium navigation invoked in preview.")}
      banner={premium || unknown ? null : <LifeCard tone="parchment" compact><UiText variant="caption">Shop banner position · fixture only · no ad request</UiText></LifeCard>}
      rewarded={premium || unknown ? null : <LifeCard compact style={{ gap: ui.spacing.sm }}>
        <UiText style={{ color: ui.colors.onPrimary }}>Rewarded CTA position · fixture only</UiText>
        <UiText variant="caption" style={{ color: ui.colors.onPrimary }}>10 coins per confirmed ad · 3 remaining today</UiText>
        <LifeButton tone="parchment" title="Watch an ad for 10 coins" onPress={() => setNotice("Rewarded CTA invoked. No ad or reward request in preview.")} />
      </LifeCard>} /></View>
  </View>;
}
const Tabs = createBottomTabNavigator();
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function OtherTab() { return <ScreenShell><UiText>This screen is unchanged. Return to Shop to review.</UiText></ScreenShell>; }
function PreviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs.Navigator initialRouteName="shop" screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name}
      component={name === "shop" ? PreviewShop : OtherTab}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs.Navigator>;
}
export default function ShopPreview() {
  return __DEV__ ? <SafeAreaProvider><NavigationContainer><PreviewTabs /></NavigationContainer></SafeAreaProvider> : null;
}
