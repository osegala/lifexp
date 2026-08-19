package com.productivity.productivity.repository;

import com.productivity.productivity.entity.Friendship;
import com.productivity.productivity.entity.FriendshipStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    Optional<Friendship> findByRequesterIdAndReceiverId(Long requesterId, Long receiverId);

    @Query("""
            select friendship from Friendship friendship
            where (friendship.requester.id = :userId or friendship.receiver.id = :userId)
              and friendship.status = :status
            order by friendship.createdAt desc
            """)
    List<Friendship> findForUserByStatus(Long userId, FriendshipStatus status);

    @Query("""
            select friendship from Friendship friendship
            where friendship.requester.id = :userId or friendship.receiver.id = :userId
            order by friendship.createdAt desc
            """)
    List<Friendship> findForUser(Long userId);
}
