import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProfile, getTierLabel } from "@/lib/use-profile";
import { queryClient } from "@/lib/query-client";
import { C } from "@/lib/theme";

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
      <Text style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary, marginBottom: 24 }}>
        Profile
      </Text>

      {/* Identity */}
      <View style={{
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
        padding: 20,
        marginBottom: 12,
      }}>
        {isLoading ? (
          <ActivityIndicator size="small" color={C.green} />
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.textPrimary }}>
              @{profile?.username ?? "…"}
            </Text>
            {profile?.display_name && profile.display_name !== profile.username && (
              <Text style={{ color: C.textMuted, marginTop: 2, fontSize: 13 }}>{profile.display_name}</Text>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <View style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 14,
                backgroundColor: C.surface2,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: C.border,
              }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: C.gold }}>
                  {profile?.total_points?.toLocaleString() ?? "0"}
                </Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>
                  points
                </Text>
              </View>
              <View style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 14,
                backgroundColor: C.surface2,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: C.border,
              }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary }}>
                  {loadingList ? "…" : (lifeList?.length ?? 0)}
                </Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>
                  species
                </Text>
              </View>
            </View>

            <View style={{
              marginTop: 12,
              backgroundColor: C.greenFaint,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              alignSelf: "flex-start",
              borderWidth: 1,
              borderColor: C.greenDim,
            }}>
              <Text style={{ color: C.green, fontWeight: "700", fontSize: 12, letterSpacing: 0.3 }}>
                {getTierLabel(profile?.tier ?? "novice").toUpperCase()}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Life list header */}
      <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
          Life List
        </Text>
        {lifeList && (
          <Text style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>
            {lifeList.length} species
          </Text>
        )}
      </View>
    </View>
  );

  const footer = (
    <Pressable
      onPress={handleSignOut}
      style={{
        borderWidth: 1,
        borderColor: "#450a0a",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 20,
        marginBottom: 16,
      }}
    >
      <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 }}>
        SIGN OUT
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        data={lifeList ?? []}
        keyExtractor={(item) => item.species_id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          loadingList ? (
            <ActivityIndicator size="small" color={C.green} style={{ marginTop: 8 }} />
          ) : (
            <Text style={{ color: C.textMuted, marginTop: 8, fontSize: 13 }}>
              No species yet — go log a sighting.
            </Text>
          )
        }
        renderItem={({ item, index }) => (
          <View style={{
            backgroundColor: C.surface,
            borderRadius: 8,
            padding: 12,
            marginBottom: 6,
            borderWidth: 1,
            borderColor: C.border,
            flexDirection: "row",
            alignItems: "center",
          }}>
            <Text style={{ width: 32, color: C.textMuted, fontSize: 12, fontWeight: "700" }}>
              {index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.textPrimary }}>
                {item.common_name}
              </Text>
              <Text style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", marginTop: 1 }}>
                {item.scientific_name}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              {new Date(item.first_seen).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "2-digit",
              })}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
