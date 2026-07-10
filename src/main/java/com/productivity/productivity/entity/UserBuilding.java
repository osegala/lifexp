package com.productivity.productivity.entity;

import jakarta.persistence.*;

@Entity
@Table(
        name = "user_buildings",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "building_type"})
)
public class UserBuilding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "building_type", nullable = false)
    private BuildingType buildingType;

    @Column(nullable = false)
    private int level = 1;

    @Column(nullable = false)
    private int totalXp = 0;

    public UserBuilding() {
    }

    public UserBuilding(User user, BuildingType buildingType) {
        this.user = user;
        this.buildingType = buildingType;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public BuildingType getBuildingType() { return buildingType; }
    public int getLevel() { return level; }
    public int getTotalXp() { return totalXp; }

    public void setUser(User user) { this.user = user; }
    public void setBuildingType(BuildingType buildingType) { this.buildingType = buildingType; }
    public void setLevel(int level) { this.level = level; }
    public void setTotalXp(int totalXp) { this.totalXp = totalXp; }
}
