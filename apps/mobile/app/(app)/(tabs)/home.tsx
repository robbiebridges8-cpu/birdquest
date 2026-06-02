import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useProfile, getTierLabel } from "@/lib/use-profile";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

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
  const { data: profile, isLoading } = useProfile();
  const { data: stats } = useSightingStats();

  const points = profile?.total_points ?? 0;
  const tier = profile?.tier ?? "novice";
  const tierProgress = TIER_PROGRESS[tier] ?? TIER_PROGRESS.novice;
  const progressPct = tierProgress.next
    ? Math.min(1, (points - tierProgress.prevMin) / (tierProgress.next - tierProgress.prevMin))
    : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>

        {/* Greeting */}
        {isLoading ? (
          <View style={{ height: 20, marginBottom: 32 }} />
        ) : (
          <Text style={{ fontSize: 13, color: C.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 32 }}>
            Welcome back, {profile?.username ?? "birder"}
          </Text>
        )}

        {/* Points hero */}
        <View style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.border,
          paddingVertical: 36,
          alignItems: "center",
          marginBottom: 12,
        }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={C.green} />
          ) : (
            <>
              <Text style={{ fontSize: 80, fontWeight: "800", color: C.gold, lineHeight: 84 }}>
                {points.toLocaleString()}
              </Text>
              <Text style={{
                fontSize: 11,
                color: C.textMuted,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginTop: 4,
                marginBottom: 16,
              }}>
                points
              </Text>
              <View style={{
                backgroundColor: C.greenFaint,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: C.greenDim,
              }}>
                <Text style={{ color: C.green, fontWeight: "700", fontSize: 13, letterSpacing: 0.3 }}>
                  {getTierLabel(tier)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{
            flex: 1,
            backgroundColor: C.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            alignItems: "center",
          }}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: C.textPrimary }}>
              {stats?.speciesCount ?? "—"}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>
              species
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: C.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            alignItems: "center",
          }}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: C.textPrimary }}>
              {stats?.sightingsCount ?? "—"}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>
              sightings
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        {!isLoading && (
          <View style={{
            backgroundColor: C.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            marginBottom: 24,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.3 }}>
                {getTierLabel(tier)}
              </Text>
              {tierProgress.next ? (
                <Text style={{ fontSize: 12, color: C.textMuted }}>
                  {(tierProgress.next - points).toLocaleString()} to {tierProgress.nextLabel}
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: C.green, fontWeight: "700" }}>Max rank</Text>
              )}
            </View>
            <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" }}>
              <View style={{
                height: 4,
                backgroundColor: C.green,
                borderRadius: 2,
                width: `${Math.round(progressPct * 100)}%`,
              }} />
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Pressable
          onPress={() => router.push("/record")}
          style={{
            width: "100%",
            backgroundColor: C.green,
            borderRadius: 8,
            paddingVertical: 18,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <Text style={{ color: "#080d09", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 }}>
            LOG A SIGHTING
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
