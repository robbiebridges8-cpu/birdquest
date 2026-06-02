import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getTierLabel } from "@/lib/use-profile";

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

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { data, isLoading, error } = useLeaderboard();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 24 }}>
          Leaderboard
        </Text>

        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        )}

        {error && (
          <Text style={{ color: "#ef4444", textAlign: "center" }}>{(error as Error).message}</Text>
        )}

        {data && (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const isMe = item.id === user?.id;
              return (
                <View
                  style={{
                    backgroundColor: isMe ? "#f0fdf4" : "#fff",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: isMe ? "#86efac" : "#f3f4f6",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ width: 36, fontSize: 18, color: index < 3 ? "#111827" : "#9ca3af", fontWeight: "600" }}>
                    {index < 3 ? MEDALS[index] : `${index + 1}`}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                      @{item.username}{isMe ? " (you)" : ""}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
                      {getTierLabel(getTierFromPoints(item.total_points))}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "bold", color: "#15803d" }}>
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
