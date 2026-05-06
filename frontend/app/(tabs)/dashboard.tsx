import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../src/api/client";
import { Avatar } from "../../src/types";
import { useAuth } from "../../src/context/AuthContext";

export default function DashboardScreen() {
  const { user, refreshUser, dashboardRefreshKey } = useAuth();
  const [avatar, setAvatar] = useState<Avatar | null>(null);

  useEffect(() => {
    async function loadDashboard() {
        await refreshUser();
            const res = await api.get<Avatar>("/avatar");
            setAvatar(res.data);
        }

        loadDashboard();
    }, [dashboardRefreshKey]);

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Dashboard</Text>

      <View style={{ padding: 16, borderWidth: 1, borderRadius: 12 }}>
        <Text style={{ fontSize: 20 }}>Level {user?.level}</Text>
        <Text>Total XP: {user?.totalXp}</Text>
        <Text>XP to next level: {user?.xpToNextLevel}</Text>
        <Text>Progress: {user?.progressPercent}%</Text>

        <View style={{ height: 16, borderWidth: 1, borderRadius: 8, marginTop: 8 }}>
          <View
            style={{
              height: "100%",
              width: `${user?.progressPercent ?? 0}%`,
              backgroundColor: "black",
              borderRadius: 8,
            }}
          />
        </View>
      </View>

      <View style={{ padding: 16, borderWidth: 1, borderRadius: 12 }}>
        <Text style={{ fontSize: 20 }}>Avatar</Text>
        <Text>Base: {avatar?.baseStyle}</Text>
        <Text>Hat ID: {avatar?.equippedHatId ?? "None"}</Text>
        <Text>Outfit ID: {avatar?.equippedOutfitId ?? "None"}</Text>
      </View>
    </View>
  );
}