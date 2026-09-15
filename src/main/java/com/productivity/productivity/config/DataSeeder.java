package com.productivity.productivity.config;

import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.CosmeticType;
import com.productivity.productivity.repository.CosmeticRepository;
import com.productivity.productivity.repository.UserRepository;
import com.productivity.productivity.service.AvatarService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 1)
public class DataSeeder implements CommandLineRunner {

    private final CosmeticRepository cosmeticRepository;
    private final UserRepository userRepository;
    private final AvatarService avatarService;

    public DataSeeder(
            CosmeticRepository cosmeticRepository,
            UserRepository userRepository,
            AvatarService avatarService
    ) {
        this.cosmeticRepository = cosmeticRepository;
        this.userRepository = userRepository;
        this.avatarService = avatarService;
    }

    @Override
    public void run(String... args) {
        seedCosmetic("Celestial Citadel", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/celestial-citadel");
        seedCosmetic("Sunset Harbor", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/sunset-harbor");
        seedCosmetic("Grand Library", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/grand-library");
        seedCosmetic("Festival Market", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/festival-market");
        seedCosmetic("Desert Oasis", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/desert-oasis");
        seedCosmetic("Snowy Village", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/snowy-village");
        seedCosmetic("Crystal Cavern", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/crystal-cavern");
        seedCosmetic("Royal Training Yard", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/royal-training-yard");
        seedCosmetic("Castle Garden", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/castle-garden");
        seedCosmetic("Moonlit Glade", CosmeticType.BACKGROUND, 1, "avatar-v2/backgrounds/moonlit-glade");
        seedCosmetic("Sky Griffin", CosmeticType.PET, 1, "avatar-v2/pets/sky-griffin");
        seedCosmetic("Moss Golem", CosmeticType.PET, 5, "avatar-v2/pets/moss-golem");
        seedCosmetic("Starlight Cat", CosmeticType.PET, 1, "avatar-v2/pets/starlight-cat");
        seedCosmetic("Tide Turtle", CosmeticType.PET, 1, "avatar-v2/pets/tide-turtle");
        seedCosmetic("Crystal Hare", CosmeticType.PET, 1, "avatar-v2/pets/crystal-hare");
        seedCosmetic("Ember Drake", CosmeticType.PET, 1, "avatar-v2/pets/ember-drake");
        seedCosmetic("Cloud Ram", CosmeticType.PET, 1, "avatar-v2/pets/cloud-ram");
        seedCosmetic("Scholar Owl", CosmeticType.PET, 1, "avatar-v2/pets/scholar-owl");
        seedCosmetic("Sunfire Fox", CosmeticType.PET, 1, "avatar-v2/pets/sunfire-fox");
        seedCosmetic("Verdant Drake", CosmeticType.PET, 1, "avatar-v2/pets/verdant-drake");
        seedCosmetic("Prismatic Radiance", CosmeticType.AURA, 1, "avatar-v2/auras/prismatic-radiance");
        seedCosmetic("Heartbloom", CosmeticType.AURA, 1, "avatar-v2/auras/heartbloom");
        seedCosmetic("Crystal Halo", CosmeticType.AURA, 1, "avatar-v2/auras/crystal-halo");
        seedCosmetic("Tempest Surge", CosmeticType.AURA, 1, "avatar-v2/auras/tempest-surge");
        seedCosmetic("Astral Vortex", CosmeticType.AURA, 1, "avatar-v2/auras/astral-vortex");
        seedCosmetic("Seraphic Light", CosmeticType.AURA, 6, "avatar-v2/auras/seraphic-light");
        seedCosmetic("Frostveil", CosmeticType.AURA, 1, "avatar-v2/auras/frostveil");
        seedCosmetic("Phoenix Flame", CosmeticType.AURA, 12, "avatar-v2/auras/phoenix-flame");
        seedCosmetic("Verdant Wisps", CosmeticType.AURA, 1, "avatar-v2/auras/verdant-wisps");
        seedCosmetic("Arcane Constellation", CosmeticType.AURA, 1, "avatar-v2/auras/arcane-constellation");

        seedCosmetic("Windblown Layers", CosmeticType.HAIR, 1, "avatar-v2/hair/windblown-layers");
        seedCosmetic("Side-Swept Layers", CosmeticType.HAIR, 1, "avatar-v2/hair/side-swept-layers");
        seedCosmetic("Spring Curls", CosmeticType.HAIR, 1, "avatar-v2/hair/spring-curls");
        seedCosmetic("Skyward Spikes", CosmeticType.HAIR, 1, "avatar-v2/hair/skyward-spikes");
        seedCosmetic("Tousled Layers", CosmeticType.HAIR, 1, "avatar-v2/hair/tousled-layers");
        seedCosmetic("Curtain Bob", CosmeticType.HAIR, 1, "avatar-v2/hair/curtain-bob");
        seedCosmetic("High Ponytail", CosmeticType.HAIR, 1, "avatar-v2/hair/high-ponytail");
        seedCosmetic("Twin Braids", CosmeticType.HAIR, 1, "avatar-v2/hair/twin-braids");
        seedCosmetic("Feathered Sweep", CosmeticType.HAIR, 1, "avatar-v2/hair/feathered-sweep");
        seedCosmetic("Long Shag", CosmeticType.HAIR, 1, "avatar-v2/hair/long-shag");
        seedCosmetic("Guild Tunic", CosmeticType.TOP, 1, "avatar-v2/tops/guild-tunic");
        seedCosmetic("Midnight Vanguard", CosmeticType.TOP, 1, "avatar-v2/tops/midnight-vanguard");
        seedCosmetic("Royal Bloom", CosmeticType.TOP, 1, "avatar-v2/tops/royal-bloom");
        seedCosmetic("Celestial Acolyte", CosmeticType.TOP, 1, "avatar-v2/tops/celestial-acolyte");
        seedCosmetic("Harbor Scout", CosmeticType.TOP, 1, "avatar-v2/tops/harbor-scout");
        seedCosmetic("Verdant Warden", CosmeticType.TOP, 1, "avatar-v2/tops/verdant-warden");
        seedCosmetic("Frostbound Vest", CosmeticType.TOP, 1, "avatar-v2/tops/frostbound-vest");
        seedCosmetic("Teal Wayfarer", CosmeticType.TOP, 1, "avatar-v2/tops/teal-wayfarer");
        seedCosmetic("Star Captain", CosmeticType.TOP, 1, "avatar-v2/tops/star-captain");
        seedCosmetic("Crimson Guard", CosmeticType.TOP, 1, "avatar-v2/tops/crimson-guard");
        seedCosmetic("Forest Ranger", CosmeticType.TOP, 1, "avatar-v2/tops/forest-ranger");
        seedCosmetic("Starlight Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/starlight");
        seedCosmetic("Forest Ranger Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/forest-ranger");
        seedCosmetic("Frostbound Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/frostbound");
        seedCosmetic("Teal Wayfarer Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/teal-wayfarer");
        seedCosmetic("Crimson Guard Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/crimson-guard");
        seedCosmetic("Royal Vanguard Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/royal-vanguard");
        seedCosmetic("Royal Bard Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/royal-bard");
        seedCosmetic("Harbor Scout Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/harbor-scout");
        seedCosmetic("Verdant Warden Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/verdant-warden");
        seedCosmetic("Celestial Acolyte Dress", CosmeticType.TOP, 1, "avatar-v2/dresses/celestial-acolyte");
        seedCosmetic("Traveler Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/traveler-trousers");
        seedCosmetic("Starlight Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/starlight-trousers");
        seedCosmetic("Forest Ranger Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/forest-ranger-trousers");
        seedCosmetic("Frostbound Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/frostbound-trousers");
        seedCosmetic("Teal Wayfarer Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/teal-wayfarer-trousers");
        seedCosmetic("Crimson Guard Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/crimson-guard-trousers");
        seedCosmetic("Royal Vanguard Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/royal-vanguard-trousers");
        seedCosmetic("Royal Bard Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/royal-bard-trousers");
        seedCosmetic("Harbor Scout Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/harbor-scout-trousers");
        seedCosmetic("Verdant Warden Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/verdant-warden-trousers");
        seedCosmetic("Celestial Acolyte Trousers", CosmeticType.BOTTOM, 1, "avatar-v2/bottoms/celestial-acolyte-trousers");
        seedCosmetic("Guild Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/guild-boots");
        seedCosmetic("Starlight Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/starlight-boots");
        seedCosmetic("Forest Ranger Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/forest-ranger-boots");
        seedCosmetic("Frostbound Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/frostbound-boots");
        seedCosmetic("Crimson Guard Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/crimson-guard-boots");
        seedCosmetic("Teal Wayfarer Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/teal-wayfarer-boots");
        seedCosmetic("Royal Vanguard Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/royal-vanguard-boots");
        seedCosmetic("Harbor Scout Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/harbor-scout-boots");
        seedCosmetic("Royal Bard Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/royal-bard-boots");
        seedCosmetic("Verdant Warden Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/verdant-warden-boots");
        seedCosmetic("Celestial Acolyte Boots", CosmeticType.BOOTS, 1, "avatar-v2/boots/celestial-acolyte-boots");
        seedCosmetic("Azure Feather Cap", CosmeticType.HAT, 1, "avatar-v2/hats/azure-feather-cap");
        seedCosmetic("Starlight Hat", CosmeticType.HAT, 1, "avatar-v2/hats/starlight-hat");
        seedCosmetic("Royal Vanguard Hat", CosmeticType.HAT, 1, "avatar-v2/hats/royal-vanguard-hat");
        seedCosmetic("Crimson Guard Hat", CosmeticType.HAT, 1, "avatar-v2/hats/crimson-guard-hat");
        seedCosmetic("Frostbound Hat", CosmeticType.HAT, 1, "avatar-v2/hats/frostbound-hat");
        seedCosmetic("Forest Ranger Hat", CosmeticType.HAT, 1, "avatar-v2/hats/forest-ranger-hat");
        seedCosmetic("Teal Wayfarer Hat", CosmeticType.HAT, 1, "avatar-v2/hats/teal-wayfarer-hat");
        seedCosmetic("Harbor Scout Hat", CosmeticType.HAT, 1, "avatar-v2/hats/harbor-scout-hat");
        seedCosmetic("Verdant Warden Hat", CosmeticType.HAT, 1, "avatar-v2/hats/verdant-warden-hat");
        seedCosmetic("Celestial Acolyte Hat", CosmeticType.HAT, 1, "avatar-v2/hats/celestial-acolyte-hat");
        seedCosmetic("Royal Bard Hat", CosmeticType.HAT, 1, "avatar-v2/hats/royal-bard-hat");
        userRepository.findAll().forEach(avatarService::initializeStarterWardrobe);

        System.out.println("Cosmetics seeded successfully.");
    }

    private void seedCosmetic(String name, CosmeticType type, int requiredLevel, String imageUrl) {
        Cosmetic cosmetic = cosmeticRepository
                .findByNameAndType(name, type)
                .orElseGet(Cosmetic::new);

        cosmetic.setName(name);
        cosmetic.setType(type);
        cosmetic.setRequiredLevel(requiredLevel);
        cosmetic.setImageUrl(imageUrl);

        cosmeticRepository.save(cosmetic);
    }

}
