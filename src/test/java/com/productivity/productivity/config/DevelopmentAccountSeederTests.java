package com.productivity.productivity.config;

import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.repository.UserBuildingRepository;
import com.productivity.productivity.repository.UserRepository;
import com.productivity.productivity.service.AvatarService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DevelopmentAccountSeederTests {
    private final UserRepository users = mock(UserRepository.class);
    private final UserBuildingRepository buildings = mock(UserBuildingRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final AvatarService avatars = mock(AvatarService.class);
    private final String initialPassword = UUID.randomUUID().toString();

    private ApplicationContextRunner context() {
        return new ApplicationContextRunner()
                .withBean(UserRepository.class, () -> users)
                .withBean(UserBuildingRepository.class, () -> buildings)
                .withBean(PasswordEncoder.class, () -> passwords)
                .withBean(AvatarService.class, () -> avatars)
                .withUserConfiguration(DevelopmentAccountSeeder.class);
    }

    @Test
    void ordinaryStartupNeverCreatesADevelopmentAccount() {
        context().run(ctx -> assertThat(ctx).doesNotHaveBean(DevelopmentAccountSeeder.class));
        context().withPropertyValues("app.dev.seed-test-account=true")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DevelopmentAccountSeeder.class));
        verifyNoInteractions(users, buildings, passwords, avatars);
    }

    @Test
    void developmentProfileStillRequiresExplicitOptIn() {
        context().withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DevelopmentAccountSeeder.class));
    }

    @Test
    void productionProfilePreventsCreationEvenWithDevelopmentSettings() {
        context().withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev", "prod"))
                .withPropertyValues("app.dev.seed-test-account=true")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DevelopmentAccountSeeder.class));
    }

    @Test
    void enabledSeederRequiresAPrivatePassword() {
        context().withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .withPropertyValues("app.dev.seed-test-account=true")
                .run(ctx -> assertThat(ctx).hasFailed());
        assertThrows(IllegalArgumentException.class,
                () -> new DevelopmentAccountSeeder(users, buildings, passwords, avatars, "short"));
    }

    @Test
    void explicitDevelopmentSetupCreatesTheAccountWithTheConfiguredPassword() {
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        when(passwords.encode(initialPassword)).thenReturn("encoded-test-value");
        context().withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .withPropertyValues("app.dev.seed-test-account=true",
                        "app.dev.test-account-password=" + initialPassword)
                .run(ctx -> {
                    assertThat(ctx).hasSingleBean(DevelopmentAccountSeeder.class);
                    ctx.getBean(DevelopmentAccountSeeder.class).run();
                });
        verify(passwords).encode(initialPassword);
        verify(users).save(argThat(user -> user.getLevel() == 36
                && user.getPassword().equals("encoded-test-value")));
        verify(buildings, times(BuildingType.values().length)).save(any());
        verify(avatars).initializeStarterWardrobe(any());
    }

    @Test
    void restartDoesNotResetAnExistingPasswordOrProgress() {
        User existing = new User();
        when(users.findByEmail("tier6@lifexp.test")).thenReturn(Optional.of(existing));
        new DevelopmentAccountSeeder(users, buildings, passwords, avatars, initialPassword).run();
        verify(users, never()).save(any());
        verifyNoInteractions(passwords, buildings, avatars);
    }

    @Test
    void usernameCollisionNeverTakesOverAnotherAccount() {
        when(users.findByUsername("TierSixTester")).thenReturn(Optional.of(new User()));
        assertThrows(IllegalStateException.class,
                () -> new DevelopmentAccountSeeder(users, buildings, passwords, avatars, initialPassword).run());
        verify(users, never()).save(any());
        verifyNoInteractions(passwords, buildings, avatars);
    }
}
