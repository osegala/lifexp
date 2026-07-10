package com.productivity.productivity.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum TaskCategory {
    SCHOOL("School", 50),
    FITNESS("Fitness", 40),
    CLEANING("Cleaning", 25),
    WORK("Work", 60),
    HEALTH("Health", 35),
    PERSONAL_GROWTH("Personal Growth", 45);

    private final String label;
    private final int xpReward;

    TaskCategory(String label, int xpReward) {
        this.label = label;
        this.xpReward = xpReward;
    }

    @JsonValue
    public String getLabel() {
        return label;
    }

    public int getXpReward() {
        return xpReward;
    }

    @JsonCreator
    public static TaskCategory fromValue(String value) {
        if (value == null) {
            return null;
        }

        return Arrays.stream(values())
                .filter(category ->
                        category.name().equalsIgnoreCase(value)
                                || category.label.equalsIgnoreCase(value)
                                || category.name().replace("_", " ").equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown task category: " + value));
    }
}
