import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../../src/api/client";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import LifeInput from "../../src/components/LifeInput";
import { colors, radius, spacing } from "../../src/theme/theme";
import { ChatMessage, Friendship, SocialUser } from "../../src/types";

export default function SocialScreen() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [realmMessages, setRealmMessages] = useState<ChatMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const [directMessage, setDirectMessage] = useState("");
  const [directFriend, setDirectFriend] = useState<SocialUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadSocial = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [friendsRes, chatRes] = await Promise.all([
        api.get<Friendship[]>("/social/friends"),
        api.get<ChatMessage[]>("/social/chat/realm?realm=town-square"),
      ]);
      setFriends(friendsRes.data);
      setRealmMessages(chatRes.data);
    } catch (error) {
      console.log("Social load error:", error);
      Alert.alert("Error", "Could not load social features.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSocial();
    }, [loadSocial]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void loadSocial(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [loadSocial]);

  useEffect(() => {
    if (!directFriend) {
      return;
    }

    const interval = setInterval(() => {
      void refreshDirectChat(directFriend.id);
    }, 3500);

    return () => clearInterval(interval);
  }, [directFriend]);

  const acceptedFriends = useMemo(
    () => friends.filter((friendship) => friendship.status === "ACCEPTED"),
    [friends],
  );
  const incomingRequests = useMemo(
    () =>
      friends.filter(
        (friendship) =>
          friendship.status === "PENDING" && friendship.incoming,
      ),
    [friends],
  );
  const sentRequests = useMemo(
    () =>
      friends.filter(
        (friendship) =>
          friendship.status === "PENDING" && !friendship.incoming,
      ),
    [friends],
  );

  const searchUsers = useCallback(async (searchQuery = query.trim(), showError = true) => {
    if (searchQuery.trim().length < 2) {
      setUsers([]);
      return;
    }

    try {
      const response = await api.get<SocialUser[]>(
        `/social/users/search?query=${encodeURIComponent(searchQuery.trim())}`,
      );
      setUsers(response.data);
    } catch (error) {
      console.log("Search users error:", error);
      if (showError) {
        Alert.alert("Error", "Could not search players.");
      }
    }
  }, [query]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setUsers([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchUsers(trimmedQuery, false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, searchUsers]);

  async function requestFriend(user: SocialUser) {
    try {
      setBusyId(user.id);
      await api.post(`/social/friends/${user.id}/request`);
      await loadSocial(false);
    } catch (error) {
      console.log("Friend request error:", error);
      Alert.alert("Social", "Could not send that friend request.");
    } finally {
      setBusyId(null);
    }
  }

  async function acceptFriend(friendship: Friendship) {
    try {
      setBusyId(friendship.id);
      await api.post(`/social/friends/requests/${friendship.id}/accept`);
      await loadSocial(false);
    } catch (error) {
      console.log("Accept friend error:", error);
      Alert.alert("Social", "Could not accept that request.");
    } finally {
      setBusyId(null);
    }
  }

  function visitBase(user: SocialUser) {
    router.push({
      pathname: "/social-base" as never,
      params: { userId: String(user.id), username: user.username },
    });
  }

  async function sendRealmMessage() {
    if (!message.trim()) {
      return;
    }

    try {
      await api.post<ChatMessage>("/social/chat/messages", {
        realm: "town-square",
        body: message.trim(),
      });
      setMessage("");
      const response = await api.get<ChatMessage[]>(
        "/social/chat/realm?realm=town-square",
      );
      setRealmMessages(response.data);
    } catch (error) {
      console.log("Send realm message error:", error);
      Alert.alert("Chat", "Could not send that message.");
    }
  }

  async function openDirectChat(user: SocialUser) {
    try {
      setBusyId(user.id);
      const response = await api.get<ChatMessage[]>(
        `/social/chat/direct/${user.id}`,
      );
      setDirectFriend(user);
      setDirectMessages(response.data);
    } catch (error) {
      console.log("Direct chat load error:", error);
      Alert.alert("Chat", "Could not open that chat.");
    } finally {
      setBusyId(null);
    }
  }

  async function refreshDirectChat(friendId: number) {
    try {
      const response = await api.get<ChatMessage[]>(
        `/social/chat/direct/${friendId}`,
      );
      setDirectMessages(response.data);
    } catch (error) {
      console.log("Direct chat refresh error:", error);
    }
  }

  async function sendDirectMessage() {
    if (!directFriend || !directMessage.trim()) {
      return;
    }

    try {
      await api.post<ChatMessage>("/social/chat/messages", {
        recipientId: directFriend.id,
        body: directMessage.trim(),
      });
      setDirectMessage("");
      await refreshDirectChat(directFriend.id);
    } catch (error) {
      console.log("Send direct message error:", error);
      Alert.alert("Chat", "Could not send that message.");
    }
  }

  if (loading && friends.length === 0 && realmMessages.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Opening town square...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <LifeCard compact>
        <Text style={styles.cardTitle}>Find Players</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <LifeInput
              placeholder="Search username"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
          <Pressable onPress={() => searchUsers()} style={styles.searchButton}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.userList}>
          {users.map((user) => (
            <PlayerRow
              key={user.id}
              user={user}
              busy={busyId === user.id}
              requested={friends.some(
                (friendship) =>
                  friendship.user.id === user.id &&
                  friendship.status === "PENDING",
              )}
              friends={friends.some(
                (friendship) =>
                  friendship.user.id === user.id &&
                  friendship.status === "ACCEPTED",
              )}
              onAdd={() => requestFriend(user)}
              onVisit={() => visitBase(user)}
            />
          ))}
          {query.trim().length >= 2 && users.length === 0 && (
            <Text style={styles.emptyText}>No matching players yet.</Text>
          )}
        </View>
      </LifeCard>

      <LifeCard compact>
        <Text style={styles.cardTitle}>Friend Requests</Text>
        <View style={styles.userList}>
          {incomingRequests.map((friendship) => (
            <View key={friendship.id} style={styles.friendRow}>
              <View style={styles.avatarDot}>
                <Text style={styles.avatarInitial}>
                  {friendship.user.username[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.friendCopy}>
                <Text style={styles.playerName}>{friendship.user.username}</Text>
                <Text style={styles.playerMeta}>
                  {friendship.status.toLowerCase()} - level {friendship.user.level}
                </Text>
              </View>
              <LifeButton
                title={busyId === friendship.id ? "..." : "Accept"}
                onPress={() => acceptFriend(friendship)}
                disabled={busyId === friendship.id}
              />
            </View>
          ))}
          {incomingRequests.length === 0 && sentRequests.length === 0 && (
            <Text style={styles.emptyText}>No pending requests.</Text>
          )}
          {sentRequests.map((friendship) => (
            <View key={friendship.id} style={styles.pendingSentRow}>
              <Text style={styles.playerName}>{friendship.user.username}</Text>
              <Text style={styles.playerMeta}>Request sent</Text>
            </View>
          ))}
        </View>
      </LifeCard>

      <LifeCard compact>
        <Text style={styles.cardTitle}>Friends</Text>
        <View style={styles.userList}>
          {acceptedFriends.map((friendship) => (
            <View key={friendship.id} style={styles.friendRow}>
              <View style={styles.avatarDot}>
                <Text style={styles.avatarInitial}>
                  {friendship.user.username[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.friendCopy}>
                <Text style={styles.playerName}>{friendship.user.username}</Text>
                <Text style={styles.playerMeta}>level {friendship.user.level}</Text>
              </View>
              <View style={styles.playerActions}>
                <IconAction
                  icon="chat-outline"
                  onPress={() => openDirectChat(friendship.user)}
                />
                <IconAction
                  icon="map-search-outline"
                  onPress={() => visitBase(friendship.user)}
                />
              </View>
            </View>
          ))}
          {acceptedFriends.length === 0 && (
            <Text style={styles.emptyText}>Search for players to start your friend list.</Text>
          )}
        </View>
      </LifeCard>

      {directFriend && (
        <LifeCard compact>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Chat with {directFriend.username}</Text>
            <Pressable onPress={() => setDirectFriend(null)} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={directMessages.slice(-12)}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                <Text style={styles.messageSender}>{item.sender.username}</Text>
                <Text style={styles.messageBody}>{item.body}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No direct messages yet.</Text>
            }
          />
          <View style={styles.chatComposer}>
            <View style={styles.chatInput}>
              <LifeInput
                placeholder="Message your friend"
                value={directMessage}
                onChangeText={setDirectMessage}
              />
            </View>
            <LifeButton title="Send" onPress={sendDirectMessage} />
          </View>
        </LifeCard>
      )}

      <LifeCard compact>
        <Text style={styles.cardTitle}>Town Square</Text>
        <FlatList
          data={realmMessages.slice(-12)}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <Text style={styles.messageSender}>{item.sender.username}</Text>
              <Text style={styles.messageBody}>{item.body}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet.</Text>
          }
        />
        <View style={styles.chatComposer}>
          <View style={styles.chatInput}>
            <LifeInput
              placeholder="Write a short message"
              value={message}
              onChangeText={setMessage}
            />
          </View>
          <LifeButton title="Send" onPress={sendRealmMessage} />
        </View>
      </LifeCard>
    </ScrollView>
  );
}

function PlayerRow({
  user,
  busy,
  requested,
  friends,
  onAdd,
  onVisit,
}: {
  user: SocialUser;
  busy: boolean;
  requested: boolean;
  friends: boolean;
  onAdd: () => void;
  onVisit: () => void;
}) {
  return (
    <View style={styles.friendRow}>
      <View style={styles.avatarDot}>
        <Text style={styles.avatarInitial}>{user.username[0]?.toUpperCase() ?? "?"}</Text>
      </View>
      <View style={styles.friendCopy}>
        <Text style={styles.playerName}>{user.username}</Text>
        <Text style={styles.playerMeta}>
          Level {user.level} - {user.currentStreak} day streak
        </Text>
      </View>
      <View style={styles.playerActions}>
        <IconAction icon="map-search-outline" onPress={onVisit} />
        <Pressable
          onPress={onAdd}
          disabled={busy || requested || friends}
          style={[styles.addButton, busy && styles.addButtonDisabled]}
        >
          <MaterialCommunityIcons
            name={friends ? "account-check" : requested ? "clock-outline" : "account-plus"}
            size={19}
            color={colors.text}
          />
        </Pressable>
      </View>
    </View>
  );
}

function IconAction({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconAction}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: colors.mutedText, fontWeight: "600" },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  subtitle: { color: colors.mutedText, fontSize: 16, marginTop: 2 },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  searchInput: { flex: 1, minWidth: 150 },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  userList: { gap: spacing.sm, marginTop: spacing.md },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatarDot: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.text, fontWeight: "700" },
  friendCopy: { flex: 1, minWidth: 0 },
  playerName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  playerMeta: { color: colors.mutedText, marginTop: 3, fontWeight: "600" },
  playerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { opacity: 0.6 },
  pendingSentRow: {
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  messageRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  messageSender: { color: colors.accent, fontWeight: "700" },
  messageBody: { color: colors.text, marginTop: 3, lineHeight: 20 },
  chatComposer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chatInput: { flex: 1 },
  emptyText: { color: colors.mutedText, lineHeight: 20 },
});
