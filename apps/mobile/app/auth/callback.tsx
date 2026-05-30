import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      router.replace("/");
    } else {
      const timeout = setTimeout(() => {
        router.replace("/auth/login");
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [user, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
      <ActivityIndicator size="large" color="#16a34a" />
      <Text style={{ color: "#6b7280", marginTop: 16 }}>Signing you in...</Text>
    </View>
  );
}
