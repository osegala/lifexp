package com.productivity.productivity.controller;

import com.productivity.productivity.dto.*;
import com.productivity.productivity.service.SocialService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
public class SocialController {
    private final SocialService socialService;

    public SocialController(SocialService socialService) {
        this.socialService = socialService;
    }

    @GetMapping("/users/search")
    public List<SocialUserResponse> searchUsers(@RequestParam String query) {
        return socialService.searchUsers(query);
    }

    @GetMapping("/friends")
    public List<FriendshipResponse> getFriends() {
        return socialService.getFriendsForCurrentUser();
    }

    @PostMapping("/friends/{userId}/request")
    public FriendshipResponse requestFriend(@PathVariable Long userId) {
        return socialService.requestFriend(userId);
    }

    @PostMapping("/friends/requests/{friendshipId}/accept")
    public FriendshipResponse acceptFriend(@PathVariable Long friendshipId) {
        return socialService.acceptFriend(friendshipId);
    }

    @GetMapping("/users/{userId}/base")
    public List<BuildingProgressResponse> getPublicBase(@PathVariable Long userId) {
        return socialService.getPublicBase(userId);
    }

    @GetMapping("/chat/realm")
    public List<ChatMessageResponse> getRealmMessages(@RequestParam(defaultValue = "town-square") String realm) {
        return socialService.getRealmMessages(realm);
    }

    @GetMapping("/chat/direct/{friendId}")
    public List<ChatMessageResponse> getDirectMessages(@PathVariable Long friendId) {
        return socialService.getDirectMessages(friendId);
    }

    @PostMapping("/chat/messages")
    public ChatMessageResponse sendMessage(@Valid @RequestBody SendMessageRequest request) {
        return socialService.sendMessage(request);
    }
}
