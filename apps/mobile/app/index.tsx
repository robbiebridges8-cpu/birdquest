import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";

export default function Index() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Wait for auth to resolve
  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // Wait for profile to load before deciding where to go
  if (profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // Profile exists but still has the auto-generated placeholder username
  if (profile && profile.username.startsWith("user_")) {
    return <Redirect href="/auth/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
