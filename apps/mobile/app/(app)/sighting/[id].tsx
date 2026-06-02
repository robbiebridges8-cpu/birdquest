import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { cellToLatLng } from "h3-js";
import { supabase } from "@/lib/supabase";
import { getRarity } from "@/lib/rarity";
import { C } from "@/lib/theme";

interface SightingDetail {
  id: string;
  observed_at: string;
  confidence: number | null;
  verification_status: string;
  points_awarded: number;
  h3_cell_r6: string;
  media_url: string | null;
  media_type: string | null;
  species: {
    common_name: string;
    scientific_name: string;
    ebird_code: string;
  } | null;
}

function useSighting(id: string) {
  return useQuery<SightingDetail | null>({
    queryKey: ["sighting", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sightings")
        .select(
          "id, observed_at, confidence, verification_status, points_awarded, h3_cell_r6, media_url, media_type, species:species_id(common_name, scientific_name, ebird_code)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SightingDetail | null;
    },
    enabled: !!id,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VERIFICATION_LABELS: Record<string, string> = {
  auto_verified: "Auto-verified",
  casual: "Casual",
  peer_review_pending: "Pending review",
  rejected: "Rejected",
};

export default function SightingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: sighting, isLoading } = useSighting(id);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.green} />
      </SafeAreaView>
    );
  }

  if (!sighting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.textMuted }}>Sighting not found.</Text>
      </SafeAreaView>
    );
  }

  const rarity = getRarity(sighting.points_awarded);
  const [lat, lng] = cellToLatLng(sighting.h3_cell_r6);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Text style={{ fontSize: 22, color: C.textSecondary }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary, flex: 1 }} numberOfLines={1}>
          {sighting.species?.common_name ?? "Unknown species"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}>
        {/* Hero */}
        <View style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.border,
          padding: 28,
          marginBottom: 16,
          alignItems: "center",
        }}>
          <Text style={{ fontSize: 34, fontWeight: "800", color: C.textPrimary, textAlign: "center", lineHeight: 40 }}>
            {sighting.species?.common_name ?? "Unknown"}
          </Text>
          {sighting.species?.scientific_name && (
            <Text style={{ fontSize: 15, color: C.textMuted, fontStyle: "italic", marginTop: 6 }}>
              {sighting.species.scientific_name}
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <View style={{
              backgroundColor: C.greenFaint,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: C.greenDim,
            }}>
              <Text style={{ color: C.green, fontWeight: "800", fontSize: 16 }}>
                +{sighting.points_awarded} pts
              </Text>
            </View>
            <View style={{
              backgroundColor: rarity.bg,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 6,
            }}>
              <Text style={{ color: rarity.color, fontWeight: "700", fontSize: 13, letterSpacing: 0.5 }}>
                {rarity.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.border,
          overflow: "hidden",
        }}>
          <DetailRow label="Date" value={formatDate(sighting.observed_at)} />
          <DetailRow
            label="Confidence"
            value={sighting.confidence != null ? `${Math.round(sighting.confidence * 100)}%` : "—"}
            border
          />
          <DetailRow
            label="Verification"
            value={VERIFICATION_LABELS[sighting.verification_status] ?? sighting.verification_status}
            border
          />
          <DetailRow
            label="Location"
            value={`${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`}
            border
          />
          {sighting.species?.ebird_code && (
            <DetailRow label="eBird code" value={sighting.species.ebird_code} border />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={{
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: border ? 1 : 0,
      borderTopColor: C.border,
    }}>
      <Text style={{
        fontSize: 10,
        color: C.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
      }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: C.textPrimary, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
