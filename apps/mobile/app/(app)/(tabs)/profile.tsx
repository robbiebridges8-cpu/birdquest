import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProfile, getTierLabel } from "@/lib/use-profile";
import { queryClient } from "@/lib/query-client";

interface LifeListEntry {
  species_id: string;
  common_name: string;
  scientific_name: string;
  first_seen: string;
}

function useLifeList(userId: string | undefined) {
  return useQuery<LifeListEntry[]>({
    queryKey: ["life-list", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("sightings")
        .select("species_id, observed_at, species:species_id(common_name, scientific_name)")
        .eq("user_id", userId)
        .order("observed_at", { ascending: true });
      if (error) throw error;

      const seen = new Map<string, LifeListEntry>();
      for (const row of (data ?? []) as any[]) {
        if (!seen.has(row.species_id)) {
          seen.set(row.species_id, {
            species_id: row.species_id,
            common_name: row.species?.common_name ?? "Unknown",
            scientific_name: row.species?.scientific_name ?? "",
            first_seen: row.observed_at,
          });
        }
      }
      return Array.from(seen.values());
    },
    enabled: !!userId,
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: lifeList, isLoading: loadingList } = useLifeList(user?.id);

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace("/auth/login");
  }

  const header = (
    <View>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 24 }}>
        Profile
      </Text>

      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: "#f3f4f6",
          marginBottom: 24,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#16a34a" />
        ) : (
          <>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
              @{profile?.username ?? "…"}
            </Text>
            {profile?.display_name && profile.display_name !== profile.username ? (
              <Text style={{ color: "#6b7280", marginTop: 2 }}>{profile.display_name}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: "#f0fdf4",
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: "bold", color: "#15803d" }}>
                  {profile?.total_points?.toLocaleString() ?? "0"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  points
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: "#f9fafb",
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: "bold", color: "#111827" }}>
                  {loadingList ? "…" : (lifeList?.length ?? 0)}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  species
                </Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 12,
                backgroundColor: "#f0fdf4",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#15803d", fontWeight: "600", fontSize: 13 }}>
                {getTierLabel(profile?.tier ?? "novice")}
              </Text>
            </View>
          </>
        )}
      </View>

      <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
        Life List{lifeList ? ` (${lifeList.length})` : ""}
      </Text>
    </View>
  );

  const footer = (
    <Pressable
      onPress={handleSignOut}
      style={{
        borderWidth: 1,
        borderColor: "#fca5a5",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 24,
        marginBottom: 16,
      }}
    >
      <Text style={{ color: "#dc2626", fontSize: 16, fontWeight: "600" }}>Sign out</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32 }}
        data={lifeList ?? []}
        keyExtractor={(item) => item.species_id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          loadingList ? (
            <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
          ) : (
            <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
              No species yet — go log a sighting!
            </Text>
          )
        }
        renderItem={({ item, index }) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: "#f3f4f6",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text style={{ width: 36, color: "#9ca3af", fontSize: 13, fontWeight: "600" }}>
              #{index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                {item.common_name}
              </Text>
              <Text style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                {item.scientific_name}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: "#9ca3af" }}>
              {new Date(item.first_seen).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
