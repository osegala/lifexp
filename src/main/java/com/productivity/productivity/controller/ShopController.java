package com.productivity.productivity.controller;

import com.productivity.productivity.dto.ShopItemResponse;
import com.productivity.productivity.service.ShopService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shop")
public class ShopController {
    private final ShopService shopService;

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    @GetMapping
    public List<ShopItemResponse> getShop() {
        return shopService.getShopForCurrentUser();
    }

    @PostMapping("/cosmetics/{cosmeticId}/purchase")
    public ShopItemResponse purchase(@PathVariable Long cosmeticId) {
        return shopService.purchaseForCurrentUser(cosmeticId);
    }
}
