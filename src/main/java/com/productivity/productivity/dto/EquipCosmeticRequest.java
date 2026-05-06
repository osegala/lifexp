package com.productivity.productivity.dto;

import jakarta.validation.constraints.NotNull;

public class EquipCosmeticRequest {

    @NotNull
    private Long cosmeticId;

    public Long getCosmeticId() { return cosmeticId; }
    public void setCosmeticId(Long cosmeticId) { this.cosmeticId = cosmeticId; }
}