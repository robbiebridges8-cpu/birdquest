import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";

export default function Index() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // If user has no profile or no username set, send to onboarding
  if (!profileLoading && profile && !profile.username) {
    return <Redirect href="/auth/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
