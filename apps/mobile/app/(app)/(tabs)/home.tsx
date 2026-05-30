import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile, getTierLabel } from "@/lib/use-profile";

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile();

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ color: "#ef4444", fontSize: 16, textAlign: "center" }}>
          Something went wrong loading your profile.
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 8 }}>
          {(error as Error).message}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#16a34a" style={{ alignSelf: "flex-start", marginBottom: 32 }} />
        ) : (
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 32 }}>
            Welcome back, {profile?.username ?? "birder"}
          </Text>
        )}

        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: "#f3f4f6", alignItems: "center", marginBottom: 24 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#16a34a" />
          ) : (
            <>
              <Text style={{ fontSize: 56, fontWeight: "bold", color: "#15803d" }}>
                {profile?.total_points?.toLocaleString() ?? "0"}
              </Text>
              <Text style={{ fontSize: 14, color: "#9ca3af", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                points
              </Text>
              <View style={{ marginTop: 16, backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 }}>
                <Text style={{ color: "#15803d", fontWeight: "600", fontSize: 14 }}>
                  {getTierLabel(profile?.tier ?? "novice")}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => router.push("/(app)/record")}
          style={{ width: "100%", backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 32 }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            🎙️  Log a sighting
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
