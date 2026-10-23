import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AuthFrame from "../src/components/ui/AuthFrame";
import { PrimaryButton, SecondaryButton } from "../src/components/ui/Buttons";
import LifeInput from "../src/components/LifeInput";
import { useAuth } from "../src/context/AuthContext";
import { authErrorMessage } from "../src/auth/errors";
import { uiTheme as ui } from "../src/theme/theme";

export default function LoginScreen() {
  const { login, sessionNotice } = useAuth();

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
      router.replace("/");
    } catch (error) {
      setError(authErrorMessage(error, "signIn"));
    } finally {
      setLoading(false);
    }
  }

  return <AuthFrame title="Welcome back" subtitle="Your next small step is waiting.">
    <Text style={styles.label}>Email</Text>
    <LifeInput tone="parchment"
      accessibilityLabel="Email"
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
    <LifeInput tone="parchment"
      accessibilityLabel="Password"
      placeholder="Your password"
      value={password}
      onChangeText={(value) => {
        setPassword(value);
        setError("");
      }}
      secureTextEntry
      textContentType="password"
    />

    {!!sessionNotice && !error && <Text accessibilityRole="alert" style={styles.sessionNotice}>{sessionNotice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}

    <View style={styles.actions}>
      <PrimaryButton
        title={loading ? "Entering..." : "Enter Evrenthia"}
        onPress={handleLogin}
        disabled={loading}
      />
      <SecondaryButton
        framed
        title="Create account"
        onPress={() => router.push("/register")}
        disabled={loading}
      />
    </View>
  </AuthFrame>;
}

const styles = StyleSheet.create({
  label: { ...ui.type.label, color: ui.colors.text, marginTop: ui.spacing.sm },
  helperText: { ...ui.type.caption, color: ui.colors.secondaryText },
  errorText: { ...ui.type.caption, color: ui.colors.danger },
  sessionNotice: { ...ui.type.caption, color: ui.colors.secondaryText },
  actions: { gap: ui.spacing.sm, marginTop: ui.spacing.md },
});
