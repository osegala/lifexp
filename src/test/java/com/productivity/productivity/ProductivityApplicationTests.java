package com.productivity.productivity;

import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.TaskCategory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProductivityApplicationTests {

    @Test
    void progressionCategoriesMapToExpectedBuildings() {
        assertEquals(BuildingType.LIBRARY, BuildingType.forCategory(TaskCategory.SCHOOL));
        assertEquals(BuildingType.TRAINING_GROUNDS, BuildingType.forCategory(TaskCategory.FITNESS));
        assertEquals(BuildingType.HOME_BASE, BuildingType.forCategory(TaskCategory.CLEANING));
        assertEquals(BuildingType.WORKSHOP, BuildingType.forCategory(TaskCategory.WORK));
        assertEquals(BuildingType.GARDEN, BuildingType.forCategory(TaskCategory.HEALTH));
        assertEquals(
                BuildingType.HALL_OF_ACHIEVEMENTS,
                BuildingType.forCategory(TaskCategory.PERSONAL_GROWTH)
        );
    }

    @Test
    void categoryLabelsRemainCompatibleWithFrontendValues() {
        assertEquals(TaskCategory.SCHOOL, TaskCategory.fromValue("School"));
        assertEquals(TaskCategory.PERSONAL_GROWTH, TaskCategory.fromValue("Personal Growth"));
        assertEquals(60, TaskCategory.WORK.getXpReward());
    }
}
