package com.productivity.productivity.service;

import com.productivity.productivity.dto.AvatarResponse;
import com.productivity.productivity.dto.CosmeticResponse;
import com.productivity.productivity.entity.*;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.AvatarRepository;
import com.productivity.productivity.repository.CosmeticRepository;
import com.productivity.productivity.repository.UserCosmeticRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

        unlockCosmeticsForUser(user);

        return mapToAvatarResponse(avatar);
    }

    public List<CosmeticResponse> getCosmeticsForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        Avatar avatar = getOrCreateAvatar(user);

        unlockCosmeticsForUser(user);

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

        unlockCosmeticsForUser(user);

        Cosmetic cosmetic = cosmeticRepository.findById(cosmeticId)
                .orElseThrow(() -> new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not found"));

        boolean ownsCosmetic = userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmeticId);

        if (!ownsCosmetic) {
            throw new ResourceNotFoundException("Cosmetic with ID " + cosmeticId + " not unlocked");
        }

        switch (cosmetic.getType()) {
            case HAT -> avatar.setEquippedHatId(cosmetic.getId());
            case OUTFIT -> avatar.setEquippedOutfitId(cosmetic.getId());
            case BACKGROUND -> avatar.setEquippedBackgroundId(cosmetic.getId());
            case PET -> avatar.setEquippedPetId(cosmetic.getId());
            case AURA -> avatar.setEquippedAuraId(cosmetic.getId());
        }

        return mapToAvatarResponse(avatarRepository.save(avatar));
    }

    public AvatarResponse createDefaultAvatar(User user) {
        Avatar avatar = new Avatar(user);
        return mapToAvatarResponse(avatarRepository.save(avatar));
    }

    private Avatar getOrCreateAvatar(User user) {
        return avatarRepository.findByUserId(user.getId())
                .orElseGet(() -> avatarRepository.save(new Avatar(user)));
    }

    private boolean isEquipped(Avatar avatar, Cosmetic cosmetic) {
        return switch (cosmetic.getType()) {
            case HAT -> cosmetic.getId().equals(avatar.getEquippedHatId());
            case OUTFIT -> cosmetic.getId().equals(avatar.getEquippedOutfitId());
            case BACKGROUND -> cosmetic.getId().equals(avatar.getEquippedBackgroundId());
            case PET -> cosmetic.getId().equals(avatar.getEquippedPetId());
            case AURA -> cosmetic.getId().equals(avatar.getEquippedAuraId());
        };
    }

    public void unlockCosmeticsForUser(User user) {
        List<Cosmetic> eligibleCosmetics = cosmeticRepository.findByRequiredLevelLessThanEqual(user.getLevel());

        for (Cosmetic cosmetic : eligibleCosmetics) {
            boolean alreadyUnlocked = userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(),
                    cosmetic.getId());

            if (!alreadyUnlocked) {
                userCosmeticRepository.save(new UserCosmetic(user, cosmetic));
            }
        }
    }

    public List<String> unlockCosmeticsForUserWithResult(User user) {
        List<Cosmetic> eligibleCosmetics = cosmeticRepository.findByRequiredLevelLessThanEqual(user.getLevel());

        List<String> unlockedNames = new ArrayList<>();

        for (Cosmetic cosmetic : eligibleCosmetics) {
            boolean alreadyUnlocked = userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(),
                    cosmetic.getId());

            if (!alreadyUnlocked) {
                userCosmeticRepository.save(new UserCosmetic(user, cosmetic));
                unlockedNames.add(cosmetic.getName());
            }
        }

        return unlockedNames;
    }

    private AvatarResponse mapToAvatarResponse(Avatar avatar) {
        return new AvatarResponse(
                avatar.getId(),
                avatar.getBaseStyle(),
                avatar.getEquippedHatId(),
                avatar.getEquippedOutfitId(),
                avatar.getEquippedBackgroundId(),
                avatar.getEquippedPetId(),
                avatar.getEquippedAuraId());
    }
}