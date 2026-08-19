package com.productivity.productivity.dto;

import jakarta.validation.constraints.NotBlank;

public class SetAvatarBodyTypeRequest {
    @NotBlank
    private String bodyType;

    public String getBodyType() { return bodyType; }
    public void setBodyType(String bodyType) { this.bodyType = bodyType; }
}
