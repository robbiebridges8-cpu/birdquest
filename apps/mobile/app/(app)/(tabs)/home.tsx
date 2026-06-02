import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useProfile, getTierLabel } from "@/lib/use-profile";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

function useSightingStats() {
  const { user } = useAuth();
  return useQuery<{ speciesCount: number; sightingsCount: number }>({
    queryKey: ["species-count", user?.id],
    queryFn: async () => {
      if (!user) return { speciesCount: 0, sightingsCount: 0 };
      const { data, error } = await supabase
        .from("sightings")
        .select("species_id")
        .eq("user_id", user.id);
      if (error) throw error;
      const rows = data ?? [];
      return {
        speciesCount: new Set(rows.map((r) => r.species_id)).size,
        sightingsCount: rows.length,
      };
    },
    enabled: !!user,
  });
}

const TIER_PROGRESS: Record<string, { prevMin: number; next: number | null; nextLabel: string | null }> = {
  novice:       { prevMin: 0,     next: 100,   nextLabel: "Beginner Birder" },
  beginner:     { prevMin: 100,   next: 500,   nextLabel: "Keen Birder" },
  intermediate: { prevMin: 500,   next: 2000,  nextLabel: "Advanced Birder" },
  advanced:     { prevMin: 2000,  next: 5000,  nextLabel: "Expert Birder" },
  expert:       { prevMin: 5000,  next: 10000, nextLabel: "Legendary Birder" },
  legendary:    { prevMin: 10000, next: null,  nextLabel: null },
};

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile();
  const { data: stats } = useSightingStats();
  const speciesCount = stats?.speciesCount ?? 0;
  const sightingsCount = stats?.sightingsCount ?? 0;

  const points = profile?.total_points ?? 0;
  const tier = profile?.tier ?? "novice";
  const tierProgress = TIER_PROGRESS[tier] ?? TIER_PROGRESS.novice;
  const progressPct = tierProgress.next
    ? Math.min(1, (points - tierProgress.prevMin) / (tierProgress.next - tierProgress.prevMin))
    : 1;

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

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#f3f4f6", alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827" }}>{speciesCount}</Text>
            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>species</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#f3f4f6", alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827" }}>{sightingsCount}</Text>
            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>sightings</Text>
          </View>
        </View>

        {!isLoading && (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#f3f4f6", marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
                {getTierLabel(tier)}
              </Text>
              {tierProgress.next ? (
                <Text style={{ fontSize: 13, color: "#9ca3af" }}>
                  {(tierProgress.next - points).toLocaleString()} pts to {tierProgress.nextLabel}
                </Text>
              ) : (
                <Text style={{ fontSize: 13, color: "#15803d", fontWeight: "600" }}>Max rank!</Text>
              )}
            </View>
            <View style={{ height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
              <View style={{ height: 8, backgroundColor: "#16a34a", borderRadius: 4, width: `${Math.round(progressPct * 100)}%` }} />
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => router.push("/record")}
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
