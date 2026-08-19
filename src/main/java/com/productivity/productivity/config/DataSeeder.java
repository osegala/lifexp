package com.productivity.productivity.config;

import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.CosmeticType;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserBuilding;
import com.productivity.productivity.repository.CosmeticRepository;
import com.productivity.productivity.repository.UserBuildingRepository;
import com.productivity.productivity.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DataSeeder implements CommandLineRunner {

    private final CosmeticRepository cosmeticRepository;
    private final UserRepository userRepository;
    private final UserBuildingRepository userBuildingRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(
            CosmeticRepository cosmeticRepository,
            UserRepository userRepository,
            UserBuildingRepository userBuildingRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.cosmeticRepository = cosmeticRepository;
        this.userRepository = userRepository;
        this.userBuildingRepository = userBuildingRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedCosmetic("Starter Cap", CosmeticType.HAT, 1, "");
        seedCosmetic("Gym Headband", CosmeticType.HAT, 2, "");
        seedCosmetic("Scholar Robe", CosmeticType.OUTFIT, 3, "");
        seedCosmetic("Forest Background", CosmeticType.BACKGROUND, 4, "");
        seedCosmetic("Tiny Dragon Pet", CosmeticType.PET, 5, "");
        seedCosmetic("Golden Aura", CosmeticType.AURA, 6, "");
        seedCosmetic("Knight Helm", CosmeticType.HAT, 7, "");
        seedCosmetic("Ranger Hood", CosmeticType.HAT, 8, "");
        seedCosmetic("Royal Armor", CosmeticType.OUTFIT, 9, "");
        seedCosmetic("Village Cloak", CosmeticType.OUTFIT, 10, "");
        seedCosmetic("Moonlit Forest", CosmeticType.BACKGROUND, 11, "");
        seedCosmetic("Phoenix Aura", CosmeticType.AURA, 12, "");
        seedTierSixTester();

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

    private void seedTierSixTester() {
        User user = userRepository.findByEmail("tier6@lifexp.test")
                .or(() -> userRepository.findByUsername("TierSixTester"))
                .orElseGet(User::new);

        user.setUsername("TierSixTester");
        user.setEmail("tier6@lifexp.test");
        user.setPassword(passwordEncoder.encode("password"));
        user.setLevel(Math.max(user.getLevel(), 36));
        user.setTotalXp(Math.max(user.getTotalXp(), totalUserXpForLevel(36)));
        user.setCoins(Math.max(user.getCoins(), 1000));

        User savedUser = userRepository.save(user);
        int tierSixXp = totalXpForLevel(36);

        for (BuildingType type : BuildingType.values()) {
            UserBuilding building = userBuildingRepository
                    .findByUserIdAndBuildingType(savedUser.getId(), type)
                    .orElseGet(() -> new UserBuilding(savedUser, type));
            building.setLevel(36);
            building.setTotalXp(tierSixXp);
            userBuildingRepository.save(building);
        }
    }

    private int totalXpForLevel(int level) {
        return (int) (40 * Math.pow(level - 1, 1.8));
    }

    private int totalUserXpForLevel(int level) {
        return (int) (15 * Math.pow(level, 2.2));
    }
}
