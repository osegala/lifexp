package com.productivity.productivity.config;

import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserBuilding;
import com.productivity.productivity.repository.UserBuildingRepository;
import com.productivity.productivity.repository.UserRepository;
import com.productivity.productivity.service.AvatarService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev & !prod")
@ConditionalOnProperty(name = "app.dev.seed-test-account", havingValue = "true")
@Order(Ordered.LOWEST_PRECEDENCE)
public class DevelopmentAccountSeeder implements CommandLineRunner {
    private final UserRepository users;
    private final UserBuildingRepository buildings;
    private final PasswordEncoder passwords;
    private final AvatarService avatars;
    private final String initialPassword;

    public DevelopmentAccountSeeder(
            UserRepository users,
            UserBuildingRepository buildings,
            PasswordEncoder passwords,
            AvatarService avatars,
            @Value("${app.dev.test-account-password:}") String initialPassword
    ) {
        if (initialPassword == null || initialPassword.isBlank() || initialPassword.length() < 16) {
            throw new IllegalArgumentException("Set DEV_TEST_ACCOUNT_PASSWORD to a random password of at least 16 characters before enabling test-account creation.");
        }
        this.users = users;
        this.buildings = buildings;
        this.passwords = passwords;
        this.avatars = avatars;
        this.initialPassword = initialPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Existing accounts are never renamed, re-levelled, or assigned a new password on startup.
        if (users.findByEmail("tier6@lifexp.test").isPresent()) {
            return;
        }
        if (users.findByUsername("TierSixTester").isPresent()) {
            throw new IllegalStateException("The development tester username is already in use.");
        }

        User user = new User();
        user.setUsername("TierSixTester");
        user.setEmail("tier6@lifexp.test");
        user.setPassword(passwords.encode(initialPassword));
        user.setLevel(36);
        user.setTotalXp((int) (15 * Math.pow(36, 2.2)));
        user.setCoins(1000);
        User saved = users.save(user);
        for (BuildingType type : BuildingType.values()) {
            UserBuilding building = new UserBuilding(saved, type);
            building.setLevel(36);
            building.setTotalXp((int) (40 * Math.pow(35, 1.8)));
            building.setVisualTier(5);
            buildings.save(building);
        }
        avatars.initializeStarterWardrobe(saved);
    }
}
