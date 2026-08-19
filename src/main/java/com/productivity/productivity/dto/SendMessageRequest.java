package com.productivity.productivity.dto;

import jakarta.validation.constraints.NotBlank;

public class SendMessageRequest {
    private Long recipientId;
    private String realm = "town-square";

    @NotBlank
    private String body;

    public Long getRecipientId() { return recipientId; }
    public String getRealm() { return realm; }
    public String getBody() { return body; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }
    public void setRealm(String realm) { this.realm = realm; }
    public void setBody(String body) { this.body = body; }
}
