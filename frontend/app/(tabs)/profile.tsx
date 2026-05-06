import { router } from "expo-router";
import { Button, Text, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace({ pathname: "/login" });
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Profile</Text>
      <Text>Username: {user?.username}</Text>
      <Text>Email: {user?.email}</Text>
      <Text>Level: {user?.level}</Text>
      <Text>Total XP: {user?.totalXp}</Text>

      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}