import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";
import LifeInput from "../src/components/LifeInput";
import AvatarRenderer from "../src/components/AvatarRenderer";
import { api } from "../src/api/client";
import { useAuth } from "../src/context/AuthContext";
import { colors, radius, spacing } from "../src/theme/theme";

const skyImage = require("../assets/base/backgrounds/sky.png");
const baseImage = require("../assets/base/buildings/library/tier-1.png");

export default function RegisterScreen() {
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bodyType, setBodyType] = useState<"BOY" | "GIRL">("BOY");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password) {
      setError("Choose a username, email, and password to start.");
      return;
    }

    if (password.length < 4) {
      setError("Use at least 4 characters for this prototype password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await register(trimmedUsername, trimmedEmail, password);
      await api.put("/avatar/body-type", { bodyType });
      router.replace("/(tabs)/dashboard");
    } catch {
      setError("Could not create that account. Try a different email or username.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <ImageBackground source={skyImage} style={styles.hero} resizeMode="cover">
        <View style={styles.heroShade}>
          <Image source={baseImage} style={styles.baseImage} resizeMode="contain" />
          <Text style={styles.title}>Start Your Base</Text>
          <Text style={styles.subtitle}>
            Create quests, earn XP, and watch small wins become visible progress.
          </Text>
        </View>
      </ImageBackground>

      <LifeCard>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="shield-plus"
            color={colors.accent}
            size={24}
          />
          <Text style={styles.cardTitle}>Create account</Text>
        </View>

        <Text style={styles.label}>Username</Text>
        <LifeInput
          placeholder="Hero name"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setError("");
          }}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Email</Text>
        <LifeInput
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={styles.label}>Password</Text>
        <LifeInput
          placeholder="At least 4 characters"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          secureTextEntry
          textContentType="newPassword"
        />
        <Text style={styles.helperText}>
          Prototype rule: 4+ characters. You can strengthen this later.
        </Text>

        <Text style={styles.label}>Starter avatar</Text>
        <View style={styles.avatarChoices}>
          {(["BOY", "GIRL"] as const).map((choice) => (
            <Pressable
              key={choice}
              onPress={() => setBodyType(choice)}
              style={[
                styles.avatarChoice,
                bodyType === choice && styles.selectedAvatarChoice,
              ]}
            >
              <AvatarRenderer bodyType={choice} size="compact" />
              <Text
                style={[
                  styles.avatarChoiceText,
                  bodyType === choice && styles.selectedAvatarChoiceText,
                ]}
              >
                {choice === "BOY" ? "Boy Hero" : "Girl Hero"}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          <LifeButton
            title={loading ? "Creating..." : "Create LifeXP Account"}
            onPress={handleRegister}
            disabled={loading}
          />
          <LifeButton
            title="Back to login"
            variant="secondary"
            onPress={() => router.push("/login")}
            disabled={loading}
          />
        </View>
      </LifeCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    minHeight: 200,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  heroShade: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(17, 23, 19, 0.26)",
  },
  baseImage: {
    width: 132,
    height: 112,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: spacing.xs,
    maxWidth: 340,
    textAlign: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  label: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "500",
    marginTop: spacing.sm,
  },
  avatarChoices: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  avatarChoice: {
    flex: 1,
    minHeight: 148,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingBottom: spacing.sm,
  },
  selectedAvatarChoice: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  avatarChoiceText: {
    color: colors.mutedText,
    fontWeight: "700",
    marginTop: -54,
  },
  selectedAvatarChoiceText: {
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "600",
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
