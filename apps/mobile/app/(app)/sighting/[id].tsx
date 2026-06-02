import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { cellToLatLng } from "h3-js";
import { supabase } from "@/lib/supabase";
import { getRarity } from "@/lib/rarity";

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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  if (!sighting) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: "#9ca3af" }}>Sighting not found.</Text>
      </SafeAreaView>
    );
  }

  const rarity = getRarity(sighting.points_awarded);
  const [lat, lng] = cellToLatLng(sighting.h3_cell_r6);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: 16, padding: 4 }}>
          <Text style={{ fontSize: 24, color: "#374151" }}>←</Text>
        </Pressable>
        <Text
          style={{ fontSize: 18, fontWeight: "700", color: "#111827", flex: 1 }}
          numberOfLines={1}
        >
          {sighting.species?.common_name ?? "Unknown species"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* Header card */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: "#f3f4f6",
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: "bold", color: "#111827", textAlign: "center" }}>
            {sighting.species?.common_name ?? "Unknown"}
          </Text>
          {sighting.species?.scientific_name && (
            <Text style={{ fontSize: 16, color: "#9ca3af", fontStyle: "italic", marginTop: 4 }}>
              {sighting.species.scientific_name}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <View
              style={{
                backgroundColor: "#f0fdf4",
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: "#15803d", fontWeight: "bold", fontSize: 15 }}>
                +{sighting.points_awarded} pts
              </Text>
            </View>
            <View
              style={{
                backgroundColor: rarity.bg,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: rarity.color, fontWeight: "600", fontSize: 14 }}>
                {rarity.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#f3f4f6",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
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

function DetailRow({
  label,
  value,
  border,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: border ? 1 : 0,
        borderTopColor: "#f3f4f6",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
