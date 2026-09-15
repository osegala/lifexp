package com.productivity.productivity.service;

import com.productivity.productivity.dto.AvatarResponse;
import com.productivity.productivity.dto.CosmeticResponse;
import com.productivity.productivity.entity.*;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.AvatarRepository;
import com.productivity.productivity.repository.CosmeticRepository;
import com.productivity.productivity.repository.UserCosmeticRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AvatarService {

    private final AvatarRepository avatarRepository;
    private final CosmeticRepository cosmeticRepository;
    private final UserCosmeticRepository userCosmeticRepository;
    private final CurrentUserService currentUserService;

    public AvatarService(
            AvatarRepository avatarRepository,
            CosmeticRepository cosmeticRepository,
            UserCosmeticRepository userCosmeticRepository,
            CurrentUserService currentUserService) {
        this.avatarRepository = avatarRepository;
        this.cosmeticRepository = cosmeticRepository;
        this.userCosmeticRepository = userCosmeticRepository;
        this.currentUserService = currentUserService;
    }

    public AvatarResponse getAvatarForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);

        return mapToAvatarResponse(avatar);
    }

    public List<CosmeticResponse> getCosmeticsForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);

        return cosmeticRepository.findAll()
                .stream()
                .map(cosmetic -> new CosmeticResponse(
                        cosmetic.getId(),
                        cosmetic.getName(),
                        cosmetic.getType(),
                        cosmetic.getRequiredLevel(),
                        cosmetic.getImageUrl(),
                        userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmetic.getId()),
                        isEquipped(avatar, cosmetic)))
                .toList();
    }

    public AvatarResponse equipCosmeticForCurrentUser(Long cosmeticId) {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);

        Cosmetic cosmetic = cosmeticRepository.findById(cosmeticId)
                .orElseThrow(() -> new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not found"));

        boolean ownsCosmetic = userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmeticId);

        if (!ownsCosmetic) {
            throw new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not unlocked");
        }

        switch (cosmetic.getType()) {
            case HAIR -> {
                avatar.setEquippedHairId(cosmetic.getId());
            }
            case HAT -> {
                avatar.setEquippedHatId(cosmetic.getId());
            }
            case TOP -> {
                avatar.setEquippedTopId(cosmetic.getId());
            }
            case BOTTOM -> {
                avatar.setEquippedBottomId(cosmetic.getId());
            }
            case BOOTS -> {
                avatar.setEquippedBootsId(cosmetic.getId());
            }
            case CAPE -> {
                avatar.setEquippedCapeId(cosmetic.getId());
            }
            case WEAPON -> {
                avatar.setEquippedWeaponId(cosmetic.getId());
            }
            case SHIELD -> {
                avatar.setEquippedShieldId(cosmetic.getId());
            }
            case BACKGROUND -> avatar.setEquippedBackgroundId(cosmetic.getId());
            case PET -> avatar.setEquippedPetId(cosmetic.getId());
            case AURA -> avatar.setEquippedAuraId(cosmetic.getId());
        }

        return mapToAvatarResponse(avatarRepository.save(avatar));
    }

    public AvatarResponse unequipCosmeticForCurrentUser(Long cosmeticId) {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);
        Cosmetic cosmetic = cosmeticRepository.findById(cosmeticId)
                .orElseThrow(() -> new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not found"));

        if (!userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmeticId)) {
            throw new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not unlocked");
        }

        unequipIfSelected(avatar, cosmetic);
        return mapToAvatarResponse(avatarRepository.save(avatar));
    }

    public AvatarResponse setBodyTypeForCurrentUser(String bodyType) {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);
        String normalizedBodyType = bodyType == null ? "BOY" : bodyType.trim().toUpperCase();

        if (!normalizedBodyType.equals("BOY") && !normalizedBodyType.equals("GIRL")) {
            normalizedBodyType = "BOY";
        }

        avatar.setBodyType(normalizedBodyType);
        return mapToAvatarResponse(avatarRepository.save(avatar));
    }

    public AvatarResponse createDefaultAvatar(User user, String bodyType) {
        Avatar avatar = new Avatar(user);
        avatar.setBodyType("GIRL".equals(bodyType) ? "GIRL" : "BOY");
        avatarRepository.save(avatar);
        initializeStarterWardrobe(user);
        return mapToAvatarResponse(getOrCreateAvatar(user));
    }

    public void initializeStarterWardrobe(User user) {
        Avatar avatar = getOrCreateAvatar(user);

        Long hairId = grantStarterCosmetic(user, "Windblown Layers", CosmeticType.HAIR);
        Long topId = grantStarterCosmetic(user, "Guild Tunic", CosmeticType.TOP);
        Long bottomId = grantStarterCosmetic(user, "Traveler Trousers", CosmeticType.BOTTOM);
        Long bootsId = grantStarterCosmetic(user, "Guild Boots", CosmeticType.BOOTS);
        grantStarterCosmetic(user, "Azure Feather Cap", CosmeticType.HAT);

        if (avatar.getEquippedHairId() == null) avatar.setEquippedHairId(hairId);
        if (avatar.getEquippedTopId() == null) avatar.setEquippedTopId(topId);
        if (avatar.getEquippedBottomId() == null) avatar.setEquippedBottomId(bottomId);
        if (avatar.getEquippedBootsId() == null) avatar.setEquippedBootsId(bootsId);

        avatarRepository.save(avatar);
    }

    private Avatar getOrCreateAvatar(User user) {
        return avatarRepository.findByUserId(user.getId())
                .orElseGet(() -> avatarRepository.save(new Avatar(user)));
    }

    private boolean isEquipped(Avatar avatar, Cosmetic cosmetic) {
        return switch (cosmetic.getType()) {
            case HAIR -> cosmetic.getId().equals(avatar.getEquippedHairId());
            case HAT -> cosmetic.getId().equals(avatar.getEquippedHatId());
            case TOP -> cosmetic.getId().equals(avatar.getEquippedTopId());
            case BOTTOM -> cosmetic.getId().equals(avatar.getEquippedBottomId());
            case BOOTS -> cosmetic.getId().equals(avatar.getEquippedBootsId());
            case CAPE -> cosmetic.getId().equals(avatar.getEquippedCapeId());
            case WEAPON -> cosmetic.getId().equals(avatar.getEquippedWeaponId());
            case SHIELD -> cosmetic.getId().equals(avatar.getEquippedShieldId());
            case BACKGROUND -> cosmetic.getId().equals(avatar.getEquippedBackgroundId());
            case PET -> cosmetic.getId().equals(avatar.getEquippedPetId());
            case AURA -> cosmetic.getId().equals(avatar.getEquippedAuraId());
        };
    }

    private AvatarResponse mapToAvatarResponse(Avatar avatar) {
        return new AvatarResponse(
                avatar.getId(),
                avatar.getBaseStyle(),
                avatar.getBodyType(),
                avatar.getEquippedHairId(),
                avatar.getEquippedHatId(),
                avatar.getEquippedTopId(),
                avatar.getEquippedBottomId(),
                avatar.getEquippedBootsId(),
                avatar.getEquippedCapeId(),
                avatar.getEquippedWeaponId(),
                avatar.getEquippedShieldId(),
                avatar.getEquippedBackgroundId(),
                avatar.getEquippedPetId(),
                avatar.getEquippedAuraId());
    }

    private Long grantStarterCosmetic(User user, String name, CosmeticType type) {
        return cosmeticRepository.findByNameAndType(name, type).map(cosmetic -> {
            if (!userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmetic.getId())) {
                userCosmeticRepository.save(new UserCosmetic(user, cosmetic));
            }
            return cosmetic.getId();
        }).orElse(null);
    }

    private void unequipIfSelected(Avatar avatar, Cosmetic cosmetic) {
        switch (cosmetic.getType()) {
            case HAIR -> {
                if (cosmetic.getId().equals(avatar.getEquippedHairId())) avatar.setEquippedHairId(null);
            }
            case HAT -> {
                if (cosmetic.getId().equals(avatar.getEquippedHatId())) avatar.setEquippedHatId(null);
            }
            case TOP -> {
                if (cosmetic.getId().equals(avatar.getEquippedTopId())) avatar.setEquippedTopId(null);
            }
            case BOTTOM -> {
                if (cosmetic.getId().equals(avatar.getEquippedBottomId())) avatar.setEquippedBottomId(null);
            }
            case BOOTS -> {
                if (cosmetic.getId().equals(avatar.getEquippedBootsId())) avatar.setEquippedBootsId(null);
            }
            case CAPE -> {
                if (cosmetic.getId().equals(avatar.getEquippedCapeId())) avatar.setEquippedCapeId(null);
            }
            case WEAPON -> {
                if (cosmetic.getId().equals(avatar.getEquippedWeaponId())) avatar.setEquippedWeaponId(null);
            }
            case SHIELD -> {
                if (cosmetic.getId().equals(avatar.getEquippedShieldId())) avatar.setEquippedShieldId(null);
            }
            case BACKGROUND -> {
                if (cosmetic.getId().equals(avatar.getEquippedBackgroundId())) avatar.setEquippedBackgroundId(null);
            }
            case PET -> {
                if (cosmetic.getId().equals(avatar.getEquippedPetId())) avatar.setEquippedPetId(null);
            }
            case AURA -> {
                if (cosmetic.getId().equals(avatar.getEquippedAuraId())) avatar.setEquippedAuraId(null);
            }
        }
    }

}
