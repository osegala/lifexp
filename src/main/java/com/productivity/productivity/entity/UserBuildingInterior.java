package com.productivity.productivity.entity;

import jakarta.persistence.*;

@Entity
@Table(
        name = "user_building_interiors",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "building_type"})
)
public class UserBuildingInterior {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "building_type", nullable = false)
    private BuildingType buildingType;

    private String wallStyle = "Stone Walls";
    private String floorStyle = "Oak Floor";
    private String centerItem = "Planning Table";
    private String leftItem = "Supply Chest";
    private String rightItem = "Banner Stand";

    public UserBuildingInterior() {
    }

    public UserBuildingInterior(User user, BuildingType buildingType) {
        this.user = user;
        this.buildingType = buildingType;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public BuildingType getBuildingType() { return buildingType; }
    public String getWallStyle() { return wallStyle; }
    public String getFloorStyle() { return floorStyle; }
    public String getCenterItem() { return centerItem; }
    public String getLeftItem() { return leftItem; }
    public String getRightItem() { return rightItem; }

    public void setUser(User user) { this.user = user; }
    public void setBuildingType(BuildingType buildingType) { this.buildingType = buildingType; }
    public void setWallStyle(String wallStyle) { this.wallStyle = wallStyle; }
    public void setFloorStyle(String floorStyle) { this.floorStyle = floorStyle; }
    public void setCenterItem(String centerItem) { this.centerItem = centerItem; }
    public void setLeftItem(String leftItem) { this.leftItem = leftItem; }
    public void setRightItem(String rightItem) { this.rightItem = rightItem; }
}
