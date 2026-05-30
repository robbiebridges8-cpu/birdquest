import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile, getTierLabel } from "@/lib/use-profile";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <View className={`bg-gray-200 rounded-lg animate-pulse ${className ?? ""}`} />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile();

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-8">
        <Text className="text-red-500 text-base text-center">
          Something went wrong loading your profile.
        </Text>
        <Text className="text-gray-400 text-sm mt-2">
          {(error as Error).message}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pt-8">
        {/* Header */}
        {isLoading ? (
          <SkeletonBlock className="h-8 w-64 mb-8" />
        ) : (
          <Text className="text-2xl font-bold text-gray-900 mb-8">
            Welcome back, {profile?.username ?? "birder"}
          </Text>
        )}

        {/* Points card */}
        <View className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 items-center mb-6">
          {isLoading ? (
            <>
              <SkeletonBlock className="h-16 w-40 mb-3" />
              <SkeletonBlock className="h-5 w-24" />
            </>
          ) : (
            <>
              <Text className="text-6xl font-bold text-brand-700">
                {profile?.total_points?.toLocaleString() ?? "0"}
              </Text>
              <Text className="text-sm text-gray-400 mt-1 uppercase tracking-wide">
                points
              </Text>
              <View className="mt-4 bg-brand-50 rounded-full px-4 py-1.5">
                <Text className="text-brand-700 font-semibold text-sm">
                  {getTierLabel(profile?.tier ?? "novice")}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* CTA button */}
        <Pressable
          onPress={() => router.push("/record")}
          className="w-full bg-brand-600 rounded-xl py-4 items-center mb-8"
        >
          <Text className="text-white text-base font-semibold">
            🎙️  Log a sighting
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
