package com.productivity.productivity.repository;

import com.productivity.productivity.entity.ChatMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findTop50ByRealmAndRecipientIsNullOrderByCreatedAtDesc(String realm);

    @Query("""
            select message from ChatMessage message
            where (message.sender.id = :currentUserId and message.recipient.id = :friendId)
               or (message.sender.id = :friendId and message.recipient.id = :currentUserId)
            order by message.createdAt desc
            limit 50
            """)
    List<ChatMessage> findRecentDirectMessages(Long currentUserId, Long friendId);
}
