package com.productivity.productivity.service;

import com.productivity.productivity.dto.BuildingProgressResponse;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.TaskCategory;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserBuilding;
import com.productivity.productivity.repository.UserBuildingRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class BuildingServiceTests {

    @Test
    void taskXpUpgradesTheMappedBuilding() {
        UserBuildingRepository repository = mock(UserBuildingRepository.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        BuildingService service = new BuildingService(repository, currentUserService);
        User user = mock(User.class);
        UserBuilding building = new UserBuilding(user, BuildingType.LIBRARY);

        when(user.getId()).thenReturn(7L);
        when(repository.findByUserIdAndBuildingTypeForUpdate(7L, BuildingType.LIBRARY))
                .thenReturn(Optional.of(building));
        when(repository.save(building)).thenReturn(building);

        BuildingProgressResponse response = service.awardTaskXp(user, TaskCategory.SCHOOL, 50);

        assertEquals(BuildingType.LIBRARY, response.getType());
        assertEquals(2, response.getLevel());
        assertEquals(50, response.getTotalXp());
        verify(repository).save(building);
    }
}
