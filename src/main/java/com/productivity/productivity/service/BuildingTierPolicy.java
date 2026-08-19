package com.productivity.productivity.service;

public final class BuildingTierPolicy {
    private BuildingTierPolicy() {}

    public static int visualTierForLevel(int level) {
        if (level >= 35) {
            return 5;
        }
        if (level >= 22) {
            return 4;
        }
        if (level >= 14) {
            return 3;
        }
        if (level >= 8) {
            return 2;
        }
        return 1;
    }

    public static int nextTierLevel(int visualTier) {
        return switch (visualTier) {
            case 1 -> 8;
            case 2 -> 14;
            case 3 -> 22;
            case 4 -> 35;
            default -> 35;
        };
    }
}
