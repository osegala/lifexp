package com.productivity.productivity.dto;

import java.time.LocalDateTime;

public class ChatMessageResponse {
    private final Long id;
    private final SocialUserResponse sender;
    private final Long recipientId;
    private final String realm;
    private final String body;
    private final LocalDateTime createdAt;

    public ChatMessageResponse(Long id, SocialUserResponse sender, Long recipientId, String realm, String body, LocalDateTime createdAt) {
        this.id = id;
        this.sender = sender;
        this.recipientId = recipientId;
        this.realm = realm;
        this.body = body;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public SocialUserResponse getSender() { return sender; }
    public Long getRecipientId() { return recipientId; }
    public String getRealm() { return realm; }
    public String getBody() { return body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
