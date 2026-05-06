package com.productivity.productivity.controller;

import com.productivity.productivity.dto.AvatarResponse;
import com.productivity.productivity.dto.CosmeticResponse;
import com.productivity.productivity.dto.EquipCosmeticRequest;
import com.productivity.productivity.service.AvatarService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/avatar")
public class AvatarController {

    private final AvatarService avatarService;

    public AvatarController(AvatarService avatarService) {
        this.avatarService = avatarService;
    }

    @GetMapping
    public AvatarResponse getMyAvatar() {
        return avatarService.getAvatarForCurrentUser();
    }

    @GetMapping("/cosmetics")
    public List<CosmeticResponse> getMyCosmetics() {
        return avatarService.getCosmeticsForCurrentUser();
    }

    @PutMapping("/equip")
    public AvatarResponse equipCosmetic(@Valid @RequestBody EquipCosmeticRequest request) {
        return avatarService.equipCosmeticForCurrentUser(request.getCosmeticId());
    }
}