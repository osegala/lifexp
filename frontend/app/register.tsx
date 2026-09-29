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
import AvatarRenderer from "../src/components/AvatarRenderer";
import AppearanceEditor from "../src/components/AppearanceEditor";
import { authErrorMessage } from "../src/auth/errors";
import { useAuth } from "../src/context/AuthContext";
import { colors, radius, spacing } from "../src/theme/theme";
import { api } from "../src/api/client";
import { apiRoutes } from "../src/api/routes";
import { DEFAULT_APPEARANCE } from "../src/avatar/appearance";
import type { AvatarAppearance } from "../src/avatar/appearance";

const skyImage = require("../assets/base/backgrounds/sky.png");
const baseImage = require("../assets/base/buildings/library/library-level-1.png");

export default function RegisterScreen() {
  const { register, confirmRegistration, login } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [appearance, setAppearance] = useState<AvatarAppearance>(DEFAULT_APPEARANCE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password) {
      setError("Choose a username, email, and password to start.");
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const nextStep = await register(trimmedUsername, trimmedEmail, password, appearance.bodyType);
      if (nextStep === "CONFIRM_SIGN_UP") {
        setAwaitingConfirmation(true);
      } else {
        await login(trimmedEmail, password);
        await api.patch(apiRoutes.me, appearance);
        router.replace("/(tabs)/dashboard");
      }
    } catch (error) {
      setError(authErrorMessage(error, "signUp"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmation() {
    if (!confirmationCode.trim()) {
      setError("Enter the confirmation code sent to your email.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await confirmRegistration(email.trim(), confirmationCode.trim(), password);
      await api.patch(apiRoutes.me, appearance);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      setError(authErrorMessage(error, "confirm"));
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
          Use 8+ characters with uppercase, lowercase, number, and symbol characters.
        </Text>

        {awaitingConfirmation && (
          <>
            <Text style={styles.label}>Email confirmation code</Text>
            <LifeInput
              placeholder="123456"
              value={confirmationCode}
              onChangeText={(value) => {
                setConfirmationCode(value);
                setError("");
              }}
              autoCapitalize="none"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
            />
          </>
        )}

        <Text style={styles.label}>Starter avatar</Text>
        <View style={styles.avatarPreview}>
          <AvatarRenderer
            bodyType={appearance.bodyType}
            hairId={appearance.hairId}
            skinColorId={appearance.skinColorId}
            hairColorId={appearance.hairColorId}
            eyeColorId={appearance.eyeColorId}
          />
        </View>
        <AppearanceEditor
          appearance={appearance}
          dirty={false}
          saving={false}
          showSaveButton={false}
          onChange={(patch) => setAppearance((current) => ({ ...current, ...patch }))}
          onSave={() => {}}
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          <LifeButton
            title={loading
              ? (awaitingConfirmation ? "Confirming..." : "Creating...")
              : (awaitingConfirmation ? "Confirm Account" : "Create LifeXP Account")}
            onPress={awaitingConfirmation ? handleConfirmation : handleRegister}
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
  avatarPreview: {
    width: 280,
    maxWidth: "100%",
    alignSelf: "center",
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
