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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 24 }}>
          Profile
        </Text>

        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#f3f4f6", marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
            @{profile?.username ?? "..."}
          </Text>
          {profile?.display_name && profile.display_name !== profile.username ? (
            <Text style={{ color: "#6b7280", marginTop: 4 }}>{profile.display_name}</Text>
          ) : null}
          <Text style={{ color: "#16a34a", fontSize: 14, marginTop: 8, fontWeight: "500" }}>
            {getTierLabel(profile?.tier ?? "novice")} — {profile?.total_points?.toLocaleString() ?? "0"} pts
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleSignOut}
          style={{ width: "100%", borderWidth: 1, borderColor: "#fca5a5", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 32 }}
        >
          <Text style={{ color: "#dc2626", fontSize: 16, fontWeight: "600" }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
