package com.productivity.productivity.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "cosmetics")
public class Cosmetic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CosmeticType type;

    @Column(nullable = false)
    private int requiredLevel;

    private String imageUrl;

    public Cosmetic() {
    }

    public Cosmetic(String name, CosmeticType type, int requiredLevel, String imageUrl) {
        this.name = name;
        this.type = type;
        this.requiredLevel = requiredLevel;
        this.imageUrl = imageUrl;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public CosmeticType getType() {
        return type;
    }

    public int getRequiredLevel() {
        return requiredLevel;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setType(CosmeticType type) {
        this.type = type;
    }

    public void setRequiredLevel(int requiredLevel) {
        this.requiredLevel = requiredLevel;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}