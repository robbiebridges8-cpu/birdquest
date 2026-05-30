import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";

export default function Index() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  if (profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (profile && profile.username.startsWith("user_")) {
    return <Redirect href="/auth/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
