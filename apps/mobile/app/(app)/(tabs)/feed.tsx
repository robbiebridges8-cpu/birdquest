import { View, Text, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getRarity } from "@/lib/rarity";
import { C } from "@/lib/theme";

interface SightingRow {
  id: string;
  observed_at: string;
  points_awarded: number;
  confidence: number | null;
  verification_status: string;
  species: {
    common_name: string;
    scientific_name: string;
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
        .select("id, observed_at, points_awarded, confidence, verification_status, species:species_id(common_name, scientific_name, ebird_code)")
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
  const router = useRouter();
  const { data: sightings, isLoading, error } = useMySightings();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary, marginBottom: 24 }}>
          Sightings
        </Text>

        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={C.green} />
          </View>
        )}

        {error && (
          <Text style={{ color: "#f87171", textAlign: "center" }}>
            {(error as Error).message}
          </Text>
        )}

        {!isLoading && sightings?.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🐦</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.textPrimary, marginBottom: 8 }}>
              Nothing logged yet
            </Text>
            <Text style={{ color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
              Head outside and record some birdsong from the home screen.
            </Text>
          </View>
        )}

        {sightings && sightings.length > 0 && (
          <FlatList
            data={sightings}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const rarity = getRarity(item.points_awarded);
              return (
                <Pressable
                  onPress={() => router.push(`/sighting/${item.id}`)}
                  style={{
                    backgroundColor: C.surface,
                    borderRadius: 10,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: C.border,
                    flexDirection: "row",
                    overflow: "hidden",
                  }}
                >
                  {/* Left rarity accent */}
                  <View style={{ width: 3, backgroundColor: rarity.color }} />

                  <View style={{ flex: 1, padding: 14, flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary }}>
                        {item.species?.common_name ?? "Unknown species"}
                      </Text>
                      {item.species?.scientific_name ? (
                        <Text style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 1 }}>
                          {item.species.scientific_name}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>
                        {formatDate(item.observed_at)}
                        {item.confidence != null && ` · ${Math.round(item.confidence * 100)}%`}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: C.gold }}>
                        +{item.points_awarded}
                      </Text>
                      <View style={{
                        backgroundColor: rarity.bg,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}>
                        <Text style={{ color: rarity.color, fontWeight: "700", fontSize: 11, letterSpacing: 0.3 }}>
                          {rarity.label.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
