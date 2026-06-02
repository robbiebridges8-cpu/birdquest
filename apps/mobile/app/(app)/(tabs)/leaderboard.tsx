import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getTierLabel } from "@/lib/use-profile";
import { C } from "@/lib/theme";

interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
  total_points: number;
}

function getTierFromPoints(points: number): string {
  if (points >= 10000) return "legendary";
  if (points >= 5000) return "expert";
  if (points >= 2000) return "advanced";
  if (points >= 500) return "intermediate";
  if (points >= 100) return "beginner";
  return "novice";
}

function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, total_points")
        .order("total_points", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["#f59e0b", "#9ca3af", "#b45309"];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { data, isLoading, error } = useLeaderboard();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary, marginBottom: 24 }}>
          Rankings
        </Text>

        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={C.green} />
          </View>
        )}

        {error && (
          <Text style={{ color: "#f87171", textAlign: "center" }}>{(error as Error).message}</Text>
        )}

        {data && (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const isMe = item.id === user?.id;
              const isTop3 = index < 3;
              return (
                <View
                  style={{
                    backgroundColor: isMe ? C.surface2 : C.surface,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: isMe ? C.borderBright : C.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {/* Rank */}
                  <View style={{ width: 36, alignItems: "center" }}>
                    {isTop3 ? (
                      <Text style={{ fontSize: 20 }}>{MEDALS[index]}</Text>
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: "700", color: C.textMuted }}>
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  {/* Name + tier */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: C.textPrimary }}>
                      @{item.username}
                      {isMe ? (
                        <Text style={{ color: C.green, fontWeight: "700" }}> ← you</Text>
                      ) : null}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, letterSpacing: 0.3 }}>
                      {getTierLabel(getTierFromPoints(item.total_points)).toUpperCase()}
                    </Text>
                  </View>

                  {/* Points */}
                  <Text style={{
                    fontSize: 17,
                    fontWeight: "800",
                    color: isTop3 ? RANK_COLORS[index] : C.textSecondary,
                  }}>
                    {item.total_points.toLocaleString()}
                  </Text>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
