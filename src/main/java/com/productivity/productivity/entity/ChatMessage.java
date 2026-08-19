package com.productivity.productivity.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @ManyToOne
    @JoinColumn(name = "recipient_id")
    private User recipient;

    @Column(nullable = false)
    private String realm = "town-square";

    @Column(nullable = false, length = 500)
    private String body;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public ChatMessage() {
    }

    public ChatMessage(User sender, User recipient, String realm, String body) {
        this.sender = sender;
        this.recipient = recipient;
        this.realm = realm;
        this.body = body;
    }

    public Long getId() { return id; }
    public User getSender() { return sender; }
    public User getRecipient() { return recipient; }
    public String getRealm() { return realm; }
    public String getBody() { return body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setSender(User sender) { this.sender = sender; }
    public void setRecipient(User recipient) { this.recipient = recipient; }
    public void setRealm(String realm) { this.realm = realm; }
    public void setBody(String body) { this.body = body; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
