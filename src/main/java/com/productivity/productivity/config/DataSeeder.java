package com.productivity.productivity.config;

import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.CosmeticType;
import com.productivity.productivity.repository.CosmeticRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DataSeeder implements CommandLineRunner {

    private final CosmeticRepository cosmeticRepository;

    public DataSeeder(CosmeticRepository cosmeticRepository) {
        this.cosmeticRepository = cosmeticRepository;
    }

    @Override
    public void run(String... args) {
        seedCosmetic("Starter Cap", CosmeticType.HAT, 1, "");
        seedCosmetic("Gym Headband", CosmeticType.HAT, 2, "");
        seedCosmetic("Scholar Robe", CosmeticType.OUTFIT, 3, "");
        seedCosmetic("Forest Background", CosmeticType.BACKGROUND, 4, "");
        seedCosmetic("Tiny Dragon Pet", CosmeticType.PET, 5, "");
        seedCosmetic("Golden Aura", CosmeticType.AURA, 6, "");

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
