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
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function FeedScreen() {
  const { data: sightings, isLoading, error } = useMySightings();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 24 }}>
          Your Sightings
        </Text>

        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        )}

        {error && (
          <Text style={{ color: "#ef4444", textAlign: "center" }}>
            {(error as Error).message}
          </Text>
        )}

        {!isLoading && sightings?.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🐦</Text>
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 8 }}>
              No sightings yet
            </Text>
            <Text style={{ color: "#6b7280", textAlign: "center" }}>
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
              <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f3f4f6", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
                    {item.species?.common_name ?? "Unknown species"}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#9ca3af", marginTop: 2 }}>
                    {formatDate(item.observed_at)}
                    {item.confidence != null && ` · ${Math.round(item.confidence * 100)}% conf`}
                  </Text>
                </View>
                <View style={{ backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ color: "#15803d", fontWeight: "bold", fontSize: 14 }}>
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
