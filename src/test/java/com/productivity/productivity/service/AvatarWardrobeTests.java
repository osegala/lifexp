package com.productivity.productivity.service;

import com.productivity.productivity.dto.CreateUserRequest;
import com.productivity.productivity.entity.*;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.*;
import com.productivity.productivity.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AvatarWardrobeTests {
    private final AvatarRepository avatars = mock(AvatarRepository.class);
    private final CosmeticRepository cosmetics = mock(CosmeticRepository.class);
    private final UserCosmeticRepository ownership = mock(UserCosmeticRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final AvatarService service = new AvatarService(avatars, cosmetics, ownership, currentUser);

    @ParameterizedTest
    @ValueSource(strings = {"BOY", "GIRL"})
    void registrationSavesTheChosenBodyWithItsStarterWardrobe(String bodyType) {
        UserRepository users = mock(UserRepository.class);
        UserService registration = new UserService();
        ReflectionTestUtils.setField(registration, "userRepository", users);
        ReflectionTestUtils.setField(registration, "passwordEncoder", mock(PasswordEncoder.class));
        ReflectionTestUtils.setField(registration, "jwtService", mock(JwtService.class));
        ReflectionTestUtils.setField(registration, "avatarService", service);
        ReflectionTestUtils.setField(registration, "buildingService", mock(BuildingService.class));
        when(users.save(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 12L);
            return user;
        });
        AtomicReference<Avatar> saved = new AtomicReference<>();
        when(avatars.save(any(Avatar.class))).thenAnswer(call -> {
            saved.set(call.getArgument(0));
            return saved.get();
        });
        when(avatars.findByUserId(12L)).thenAnswer(call -> Optional.ofNullable(saved.get()));
        Cosmetic starter = item(7L, CosmeticType.TOP, "avatar-v2/tops/guild-tunic");
        when(cosmetics.findByNameAndType("Guild Tunic", CosmeticType.TOP)).thenReturn(Optional.of(starter));

        CreateUserRequest request = new CreateUserRequest();
        request.setUsername("wardrobe-test");
        request.setEmail("wardrobe@example.test");
        request.setPassword("test-password");
        request.setBodyType(bodyType);
        registration.registerUser(request);

        assertEquals(bodyType, saved.get().getBodyType());
        assertEquals(7L, saved.get().getEquippedTopId());
        verify(ownership).save(any(UserCosmetic.class));
    }

    @Test
    void olderRegistrationRequestsDefaultToBoy() {
        assertEquals("BOY", new CreateUserRequest().getBodyType());
    }

    @ParameterizedTest
    @ValueSource(strings = {"BOY", "GIRL"})
    void eitherBodyCanWearDressesAndTopsWithoutLosingOtherEquipment(String bodyType) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(12L);
        when(currentUser.getCurrentUser()).thenReturn(user);
        Avatar avatar = new Avatar(user);
        avatar.setBodyType(bodyType);
        avatar.setEquippedBottomId(4L);
        avatar.setEquippedBootsId(5L);
        when(avatars.findByUserId(12L)).thenReturn(Optional.of(avatar));
        when(avatars.save(any(Avatar.class))).thenAnswer(call -> call.getArgument(0));
        when(cosmetics.findById(8L)).thenReturn(Optional.of(item(8L, CosmeticType.TOP, "avatar-v2/dresses/starlight")));
        when(cosmetics.findById(9L)).thenReturn(Optional.of(item(9L, CosmeticType.TOP, "avatar-v2/tops/guild-tunic")));
        when(ownership.existsByUserIdAndCosmeticId(eq(12L), anyLong())).thenReturn(true);

        assertEquals(8L, service.equipCosmeticForCurrentUser(8L).getEquippedTopId());
        service.setBodyTypeForCurrentUser(bodyType.equals("BOY") ? "GIRL" : "BOY");
        assertEquals(8L, avatar.getEquippedTopId());
        assertEquals(9L, service.equipCosmeticForCurrentUser(9L).getEquippedTopId());
        assertEquals(4L, avatar.getEquippedBottomId());
        assertEquals(5L, avatar.getEquippedBootsId());

        when(ownership.existsByUserIdAndCosmeticId(12L, 8L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> service.equipCosmeticForCurrentUser(8L));
        assertEquals(9L, avatar.getEquippedTopId());
    }

    private Cosmetic item(Long id, CosmeticType type, String imageUrl) {
        Cosmetic item = new Cosmetic("Test outfit", type, 1, imageUrl);
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }
}
