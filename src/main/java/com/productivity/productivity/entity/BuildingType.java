package com.productivity.productivity.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum BuildingType {
    HOME_BASE("Home Base"),
    WORKSHOP("Workshop"),
    LIBRARY("Library"),
    TRAINING_GROUNDS("Training Grounds"),
    GARDEN("Garden"),
    HALL_OF_ACHIEVEMENTS("Hall of Achievements");

    private final String label;

    BuildingType(String label) {
        this.label = label;
    }

    @JsonValue
    public String getLabel() {
        return label;
    }

    @JsonCreator
    public static BuildingType fromValue(String value) {
        return Arrays.stream(values())
                .filter(type -> type.name().equalsIgnoreCase(value) || type.label.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown building type: " + value));
    }

    public static BuildingType forCategory(TaskCategory category) {
        return switch (category) {
            case CLEANING -> HOME_BASE;
            case WORK -> WORKSHOP;
            case SCHOOL -> LIBRARY;
            case FITNESS -> TRAINING_GROUNDS;
            case HEALTH -> GARDEN;
            case PERSONAL_GROWTH -> HALL_OF_ACHIEVEMENTS;
        };
    }
}
