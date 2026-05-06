import { useEffect, useState } from "react";
import { Alert, Button, FlatList, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { Avatar, Cosmetic } from "../../src/types";

export default function AvatarScreen() {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);

  async function loadAvatarData() {
    const avatarResponse = await api.get<Avatar>("/avatar");
    const cosmeticsResponse = await api.get<Cosmetic[]>("/avatar/cosmetics");

    setAvatar(avatarResponse.data);
    setCosmetics(cosmeticsResponse.data);
  }

  useEffect(() => {
    loadAvatarData();
  }, []);

  async function equipCosmetic(cosmeticId: number) {
    try {
      await api.put("/avatar/equip", { cosmeticId });
      await loadAvatarData();
    } catch {
      Alert.alert("Cannot equip", "You may not have unlocked this cosmetic yet.");
    }
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Avatar</Text>

      <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, marginVertical: 16 }}>
        <Text>Base: {avatar?.baseStyle}</Text>
        <Text>Hat: {avatar?.equippedHatId ?? "None"}</Text>
        <Text>Outfit: {avatar?.equippedOutfitId ?? "None"}</Text>
        <Text>Background: {avatar?.equippedBackgroundId ?? "None"}</Text>
        <Text>Pet: {avatar?.equippedPetId ?? "None"}</Text>
        <Text>Aura: {avatar?.equippedAuraId ?? "None"}</Text>
      </View>

      <FlatList
        data={cosmetics}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>{item.name}</Text>
            <Text>{item.type}</Text>
            <Text>Required Level: {item.requiredLevel}</Text>
            <Text>{item.unlocked ? "Unlocked" : "Locked"}</Text>
            <Text>{item.equipped ? "Equipped" : ""}</Text>

            {item.unlocked && !item.equipped && (
              <Button title="Equip" onPress={() => equipCosmetic(item.id)} />
            )}
          </View>
        )}
      />
    </View>
  );
}