import { View, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getTierLabel } from "@/lib/use-profile";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-6">
        <Text variant="h3" className="mb-6 text-left tracking-tight">
          Rankings
        </Text>

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="hsl(142, 71%, 45%)" />
          </View>
        )}

        {error && (
          <Text className="text-destructive text-center">
            {(error as Error).message}
          </Text>
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
                  className={cn(
                    "flex-row items-center rounded-lg border border-border px-4 py-3 mb-1.5",
                    isMe ? "bg-secondary border-primary/30" : "bg-card"
                  )}
                >
                  {/* Rank */}
                  <View className="w-9 items-center mr-1">
                    {isTop3 ? (
                      <Text className="text-xl leading-tight">{MEDALS[index]}</Text>
                    ) : (
                      <Text className="text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  {/* Name + tier */}
                  <View className="flex-1">
                    <Text
                      className={cn(
                        "text-sm font-bold",
                        isMe ? "text-primary" : "text-foreground"
                      )}
                    >
                      @{item.username}
                      {isMe ? (
                        <Text className="text-primary font-normal"> ← you</Text>
                      ) : null}
                    </Text>
                    <Text className="text-xs text-muted-foreground tracking-wide uppercase mt-0.5">
                      {getTierLabel(getTierFromPoints(item.total_points))}
                    </Text>
                  </View>

                  {/* Points */}
                  <Text
                    className={cn(
                      "text-base font-extrabold",
                      index === 0 && "text-gold",
                      index === 1 && "text-forest-faded",
                      index === 2 && "text-forest-muted",
                      !isTop3 && "text-muted-foreground"
                    )}
                  >
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
