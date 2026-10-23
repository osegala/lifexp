import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AuthFrame from "../src/components/ui/AuthFrame";
import LifeButton from "../src/components/LifeButton";
import LifeInput from "../src/components/LifeInput";
import { useAuth } from "../src/context/AuthContext";
import { authErrorMessage } from "../src/auth/errors";
import { uiTheme as ui } from "../src/theme/theme";

export default function RegisterScreen() {
  const { register, confirmRegistration, login } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
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
      const nextStep = await register(trimmedUsername, trimmedEmail, password, "BOY");
      if (nextStep === "CONFIRM_SIGN_UP") {
        setAwaitingConfirmation(true);
      } else {
        await login(trimmedEmail, password);
        router.replace("/");
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
      router.replace("/");
    } catch (error) {
      setError(authErrorMessage(error, "confirm"));
    } finally {
      setLoading(false);
    }
  }

  return <AuthFrame title={awaitingConfirmation ? "Check your email" : "Begin your adventure"} subtitle={awaitingConfirmation ? `Enter the code sent to ${email}.` : "Make room for what matters, one day at a time."}>
    {!awaitingConfirmation && <>
      <Text style={styles.label}>Display name</Text>
      <LifeInput tone="parchment"
        accessibilityLabel="Display name"
        placeholder="Hero name"
        value={username}
        onChangeText={(value) => {
          setUsername(value);
          setError("");
        }}
        autoCapitalize="none"
      />

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
        placeholder="At least 8 characters"
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

    </>}
    {awaitingConfirmation && (
      <>
        <Text style={styles.label}>Email confirmation code</Text>
        <LifeInput tone="parchment"
          accessibilityLabel="Email confirmation code"
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

    <Text style={styles.helperText}>After confirming your account, choose your avatar and first tasks.</Text>

    {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}

    <View style={styles.actions}>
      <LifeButton tone="parchment"
        title={loading
          ? (awaitingConfirmation ? "Confirming..." : "Creating...")
          : (awaitingConfirmation ? "Confirm Account" : "Create account")}
        onPress={awaitingConfirmation ? handleConfirmation : handleRegister}
        disabled={loading}
      />
      <LifeButton tone="parchment"
        title="Back to login"
        variant="secondary"
        onPress={() => router.push("/login")}
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
