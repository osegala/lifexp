package com.productivity.productivity.service;

import com.productivity.productivity.dto.*;
import com.productivity.productivity.entity.*;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.*;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SocialService {
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserBuildingRepository userBuildingRepository;

    public SocialService(CurrentUserService currentUserService, UserRepository userRepository, FriendshipRepository friendshipRepository, ChatMessageRepository chatMessageRepository, UserBuildingRepository userBuildingRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.userBuildingRepository = userBuildingRepository;
    }

    public List<SocialUserResponse> searchUsers(String query) {
        User currentUser = currentUserService.getCurrentUser();
        String safeQuery = query == null ? "" : query.trim();
        if (safeQuery.length() < 2) {
            return List.of();
        }
        return userRepository.findTop20ByUsernameContainingIgnoreCaseOrderByUsernameAsc(safeQuery)
                .stream()
                .filter(user -> !user.getId().equals(currentUser.getId()))
                .map(this::mapUser)
                .toList();
    }

    public List<FriendshipResponse> getFriendsForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return friendshipRepository.findForUser(user.getId())
                .stream()
                .map(friendship -> mapFriendship(user, friendship))
                .toList();
    }

    @Transactional
    public FriendshipResponse requestFriend(Long receiverId) {
        User requester = currentUserService.getCurrentUser();
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (requester.getId().equals(receiver.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot friend yourself");
        }

        Friendship friendship = friendshipRepository.findByRequesterIdAndReceiverId(requester.getId(), receiver.getId())
                .or(() -> friendshipRepository.findByRequesterIdAndReceiverId(receiver.getId(), requester.getId()))
                .orElseGet(() -> friendshipRepository.save(new Friendship(requester, receiver)));

        return mapFriendship(requester, friendship);
    }

    @Transactional
    public FriendshipResponse acceptFriend(Long friendshipId) {
        User currentUser = currentUserService.getCurrentUser();
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend request not found"));

        if (!friendship.getReceiver().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Friend request not found");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        return mapFriendship(currentUser, friendshipRepository.save(friendship));
    }

    public List<BuildingProgressResponse> getPublicBase(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return userBuildingRepository.findByUserIdOrderByBuildingTypeAsc(user.getId())
                .stream()
                .map(this::mapBuilding)
                .toList();
    }

    public List<ChatMessageResponse> getRealmMessages(String realm) {
        String safeRealm = realm == null || realm.isBlank() ? "town-square" : realm.trim();
        return chatMessageRepository.findTop50ByRealmAndRecipientIsNullOrderByCreatedAtDesc(safeRealm)
                .stream()
                .sorted(Comparator.comparing(ChatMessage::getCreatedAt))
                .map(this::mapMessage)
                .toList();
    }

    public List<ChatMessageResponse> getDirectMessages(Long friendId) {
        User currentUser = currentUserService.getCurrentUser();
        return chatMessageRepository.findRecentDirectMessages(currentUser.getId(), friendId)
                .stream()
                .sorted(Comparator.comparing(ChatMessage::getCreatedAt))
                .map(this::mapMessage)
                .toList();
    }

    @Transactional
    public ChatMessageResponse sendMessage(SendMessageRequest request) {
        User sender = currentUserService.getCurrentUser();
        String body = request.getBody() == null ? "" : request.getBody().trim();

        if (body.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Messages must be 500 characters or fewer");
        }

        User recipient = null;
        if (request.getRecipientId() != null) {
            recipient = userRepository.findById(request.getRecipientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Recipient not found"));
        }

        String realm = request.getRealm() == null || request.getRealm().isBlank()
                ? "town-square"
                : request.getRealm().trim();
        ChatMessage message = chatMessageRepository.save(new ChatMessage(sender, recipient, realm, body));
        return mapMessage(message);
    }

    private FriendshipResponse mapFriendship(User currentUser, Friendship friendship) {
        User other = friendship.getRequester().getId().equals(currentUser.getId())
                ? friendship.getReceiver()
                : friendship.getRequester();
        boolean incoming = friendship.getReceiver().getId().equals(currentUser.getId());
        return new FriendshipResponse(friendship.getId(), mapUser(other), friendship.getStatus(), incoming);
    }

    private ChatMessageResponse mapMessage(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                mapUser(message.getSender()),
                message.getRecipient() == null ? null : message.getRecipient().getId(),
                message.getRealm(),
                message.getBody(),
                message.getCreatedAt()
        );
    }

    private SocialUserResponse mapUser(User user) {
        return new SocialUserResponse(user.getId(), user.getUsername(), user.getLevel(), user.getCurrentStreak());
    }

    private BuildingProgressResponse mapBuilding(UserBuilding building) {
        int level = building.getLevel();
        int currentLevelStart = totalXpForLevel(level);
        int nextLevelStart = totalXpForLevel(level + 1);
        int xpIntoLevel = building.getTotalXp() - currentLevelStart;
        int levelRange = nextLevelStart - currentLevelStart;
        int progressPercent = levelRange == 0 ? 100 : (int) ((xpIntoLevel * 100.0) / levelRange);
        return new BuildingProgressResponse(
                building.getBuildingType(),
                level,
                building.getTotalXp(),
                xpIntoLevel,
                nextLevelStart - building.getTotalXp(),
                progressPercent,
                BuildingTierPolicy.visualTierForLevel(level)
        );
    }

    private int totalXpForLevel(int level) {
        return (int) (40 * Math.pow(level - 1, 1.8));
    }
}
