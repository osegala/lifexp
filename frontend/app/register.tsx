import { router } from "expo-router";
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function RegisterScreen() {
  const { register } = useAuth();

  const [username, setUsername] = useState("owen");
  const [email, setEmail] = useState("owen2@test.com");
  const [password, setPassword] = useState("1234");

  async function handleRegister() {
    try {
      await register(username, email, password);
      router.replace("/(tabs)/dashboard");
    } catch {
      Alert.alert("Register failed", "Try a different email or username.");
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Create Account</Text>

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

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

      <Button title="Register" onPress={handleRegister} />
      <Button title="Back to login" onPress={() => router.push("/login")} />
    </View>
  );
}