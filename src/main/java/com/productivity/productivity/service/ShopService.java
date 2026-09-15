package com.productivity.productivity.service;

import com.productivity.productivity.dto.ShopItemResponse;
import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserCosmetic;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.CosmeticRepository;
import com.productivity.productivity.repository.UserCosmeticRepository;
import com.productivity.productivity.repository.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShopService {
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final CosmeticRepository cosmeticRepository;
    private final UserCosmeticRepository userCosmeticRepository;

    public ShopService(CurrentUserService currentUserService, UserRepository userRepository, CosmeticRepository cosmeticRepository, UserCosmeticRepository userCosmeticRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.cosmeticRepository = cosmeticRepository;
        this.userCosmeticRepository = userCosmeticRepository;
    }

    public List<ShopItemResponse> getShopForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return cosmeticRepository.findAll().stream()
                .map(cosmetic -> mapToShopItem(user, cosmetic))
                .toList();
    }

    @Transactional
    public ShopItemResponse purchaseForCurrentUser(Long cosmeticId) {
        User currentUser = currentUserService.getCurrentUser();
        User user = userRepository.findByIdForUpdate(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        Cosmetic cosmetic = cosmeticRepository.findById(cosmeticId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop item not found"));
        ShopItemResponse item = mapToShopItem(user, cosmetic);

        if (item.isOwned()) {
            return item;
        }

        if (item.isPremiumOnly() && !user.isPremiumActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This item requires LifeXP Pass");
        }

        if (user.getCoins() < item.getPriceCoins()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not enough coins");
        }

        user.setCoins(user.getCoins() - item.getPriceCoins());
        userRepository.save(user);
        userCosmeticRepository.save(new UserCosmetic(user, cosmetic));
        return mapToShopItem(user, cosmetic);
    }

    private ShopItemResponse mapToShopItem(User user, Cosmetic cosmetic) {
        int price = Math.max(30, cosmetic.getRequiredLevel() * 35);
        boolean premiumOnly = cosmetic.getRequiredLevel() >= 8;
        boolean owned = userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmetic.getId());

        return new ShopItemResponse(
                "cosmetic-" + cosmetic.getId(),
                cosmetic.getId(),
                cosmetic.getName(),
                cosmetic.getType(),
                cosmetic.getImageUrl(),
                price,
                premiumOnly,
                owned
        );
    }
}
