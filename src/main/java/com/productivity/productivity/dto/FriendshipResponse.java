package com.productivity.productivity.dto;

import com.productivity.productivity.entity.FriendshipStatus;

public class FriendshipResponse {
    private final Long id;
    private final SocialUserResponse user;
    private final FriendshipStatus status;
    private final boolean incoming;

    public FriendshipResponse(Long id, SocialUserResponse user, FriendshipStatus status, boolean incoming) {
        this.id = id;
        this.user = user;
        this.status = status;
        this.incoming = incoming;
    }

    public Long getId() { return id; }
    public SocialUserResponse getUser() { return user; }
    public FriendshipStatus getStatus() { return status; }
    public boolean isIncoming() { return incoming; }
}
