import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";
import LifeInput from "../src/components/LifeInput";
import { useAuth } from "../src/context/AuthContext";
import { colors, radius, spacing } from "../src/theme/theme";

const skyImage = require("../assets/base/backgrounds/sky.png");
const baseImage = require("../assets/base/buildings/home-base/tier-1.png");

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch {
      setError("Login failed. Check your email and password.");
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
          <Text style={styles.title}>LifeXP</Text>
          <Text style={styles.subtitle}>
            Turn today&apos;s plan into XP, upgrades, and a growing base.
          </Text>
        </View>
      </ImageBackground>

      <LifeCard>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="login-variant"
            color={colors.accent}
            size={24}
          />
          <Text style={styles.cardTitle}>Log in</Text>
        </View>

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
          placeholder="Your password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          secureTextEntry
          textContentType="password"
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          <LifeButton
            title={loading ? "Entering..." : "Enter LifeXP"}
            onPress={handleLogin}
            disabled={loading}
          />
          <LifeButton
            title="Create account"
            variant="secondary"
            onPress={() => router.push("/register")}
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
    fontSize: 36,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: spacing.xs,
    maxWidth: 320,
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
