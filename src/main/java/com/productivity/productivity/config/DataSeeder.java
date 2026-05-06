package com.productivity.productivity.config;

import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.CosmeticType;
import com.productivity.productivity.repository.CosmeticRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CosmeticRepository cosmeticRepository;

    public DataSeeder(CosmeticRepository cosmeticRepository) {
        this.cosmeticRepository = cosmeticRepository;
    }

    @Override
    public void run(String... args) {
        if (cosmeticRepository.count() > 0) {
            return;
        }

        cosmeticRepository.save(new Cosmetic("Starter Cap", CosmeticType.HAT, 1, "/cosmetics/hats/starter-cap.png"));
        cosmeticRepository.save(new Cosmetic("Gym Headband", CosmeticType.HAT, 2, "/cosmetics/hats/gym-headband.png"));
        cosmeticRepository.save(new Cosmetic("Scholar Robe", CosmeticType.OUTFIT, 3, "/cosmetics/outfits/scholar-robe.png"));
        cosmeticRepository.save(new Cosmetic("Forest Background", CosmeticType.BACKGROUND, 5, "/cosmetics/backgrounds/forest.png"));
        cosmeticRepository.save(new Cosmetic("Tiny Dragon Pet", CosmeticType.PET, 10, "/cosmetics/pets/tiny-dragon.png"));
        cosmeticRepository.save(new Cosmetic("Golden Aura", CosmeticType.AURA, 20, "/cosmetics/auras/golden-aura.png"));
    }
}