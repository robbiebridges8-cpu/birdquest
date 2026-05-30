import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface SightingRow {
  id: string;
  observed_at: string;
  points_awarded: number;
  confidence: number | null;
  verification_status: string;
  species: {
    common_name: string;
    ebird_code: string;
  } | null;
}

function useMySightings() {
  const { user } = useAuth();

  return useQuery<SightingRow[]>({
    queryKey: ["sightings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("sightings")
        .select("id, observed_at, points_awarded, confidence, verification_status, species:species_id(common_name, ebird_code)")
        .eq("user_id", user.id)
        .order("observed_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as SightingRow[];
    },
    enabled: !!user,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedScreen() {
  const { data: sightings, isLoading, error } = useMySightings();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-2xl font-bold text-gray-900 mb-6">
          Your Sightings
        </Text>

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        )}

        {error && (
          <Text className="text-red-500 text-center">
            {(error as Error).message}
          </Text>
        )}

        {!isLoading && sightings?.length === 0 && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-4xl mb-4">🐦</Text>
            <Text className="text-lg font-semibold text-gray-700 mb-2">
              No sightings yet
            </Text>
            <Text className="text-gray-500 text-center">
              Record some birdsong from the home screen to log your first sighting.
            </Text>
          </View>
        )}

        {sightings && sightings.length > 0 && (
          <FlatList
            data={sightings}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.species?.common_name ?? "Unknown species"}
                  </Text>
                  <Text className="text-sm text-gray-400 mt-0.5">
                    {formatDate(item.observed_at)}
                    {item.confidence != null && ` · ${Math.round(item.confidence * 100)}% conf`}
                  </Text>
                </View>
                <View className="bg-brand-50 rounded-full px-3 py-1">
                  <Text className="text-brand-700 font-bold text-sm">
                    +{item.points_awarded}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
