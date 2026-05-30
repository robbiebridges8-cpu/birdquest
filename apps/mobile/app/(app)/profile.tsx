import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useProfile, getTierLabel } from "@/lib/use-profile";
import { queryClient } from "@/lib/query-client";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace("/auth/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Profile</Text>

        <View className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <Text className="text-lg font-semibold text-gray-900">
            @{profile?.username ?? "..."}
          </Text>
          {profile?.display_name && (
            <Text className="text-gray-500 mt-1">{profile.display_name}</Text>
          )}
          <Text className="text-brand-600 text-sm mt-2 font-medium">
            {getTierLabel(profile?.tier ?? "novice")} — {profile?.total_points?.toLocaleString() ?? "0"} pts
          </Text>
        </View>

        <View className="flex-1" />

        <Pressable
          onPress={handleSignOut}
          className="w-full border border-red-300 rounded-xl py-4 items-center mb-8"
        >
          <Text className="text-red-600 text-base font-semibold">
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
