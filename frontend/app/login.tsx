import { router } from "expo-router";
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("owen@test.com");
  const [password, setPassword] = useState("1234");

  async function handleLogin() {
    try {
      await login(email, password);
      router.replace("/(tabs)/dashboard");
    } catch {
      Alert.alert("Login failed", "Check your email and password.");
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>LifeXP Login</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <Button title="Login" onPress={handleLogin} />
      <Button title="Create account" onPress={() => router.push("/register")} />
    </View>
  );
}