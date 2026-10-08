import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { authDestination } from "../src/auth/destination";

export default function Index() {
  const { token, user, loading } = useAuth();
  const destination = authDestination(token, user);

  if (loading || !destination) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}
