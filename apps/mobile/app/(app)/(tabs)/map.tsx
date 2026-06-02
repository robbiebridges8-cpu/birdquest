import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { cellToLatLng } from "h3-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getRarity } from "@/lib/rarity";

interface MapSighting {
  id: string;
  h3_cell_r6: string;
  points_awarded: number;
  species: { common_name: string } | null;
  lat: number;
  lng: number;
}

interface RareSighting extends MapSighting {
  observed_at: string;
  profiles: { username: string } | null;
}

function useMyMapSightings(userId: string | undefined) {
  return useQuery<MapSighting[]>({
    queryKey: ["map-sightings-mine", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("sightings")
        .select("id, h3_cell_r6, points_awarded, species:species_id(common_name)")
        .eq("user_id", userId)
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((s: any) => {
        const [lat, lng] = cellToLatLng(s.h3_cell_r6);
        return { ...s, lat, lng };
      });
    },
    enabled: !!userId,
  });
}

function useRareSightings(userId: string | undefined) {
  return useQuery<RareSighting[]>({
    queryKey: ["map-sightings-rare"],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("sightings")
        .select(
          "id, h3_cell_r6, points_awarded, observed_at, species:species_id(common_name), profiles:user_id(username)"
        )
        .neq("user_id", userId)
        .gte("points_awarded", 20)
        .order("observed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((s: any) => {
        const [lat, lng] = cellToLatLng(s.h3_cell_r6);
        return { ...s, lat, lng };
      });
    },
    enabled: !!userId,
  });
}

export default function MapScreen() {
  const { user } = useAuth();
  const { data: mySightings, isLoading } = useMyMapSightings(user?.id);
  const [showRare, setShowRare] = useState(true);
  const { data: rareSightings } = useRareSightings(user?.id);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [region, setRegion] = useState({
    latitude: 51.5,
    longitude: -1.5,
    latitudeDelta: 6,
    longitudeDelta: 6,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationGranted(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 1,
          longitudeDelta: 1,
        });
      } else {
        setLocationGranted(false);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={locationGranted === true}
        showsMyLocationButton={false}
      >
        {mySightings?.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.species?.common_name ?? "Unknown"}
            description={`+${s.points_awarded} pts`}
            pinColor="#16a34a"
          />
        ))}

        {showRare &&
          rareSightings?.map((s) => {
            const rarity = getRarity(s.points_awarded);
            return (
              <Marker
                key={`rare-${s.id}`}
                coordinate={{ latitude: s.lat, longitude: s.lng }}
                title={`${s.species?.common_name ?? "Unknown"} — ${rarity.label}`}
                description={`@${(s.profiles as any)?.username ?? "birder"} · +${s.points_awarded} pts`}
                pinColor="#7c3aed"
              />
            );
          })}
      </MapView>

      {/* Controls overlay */}
      <View
        style={{
          position: "absolute",
          top: 56,
          left: 16,
          right: 16,
          flexDirection: "row",
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => setShowRare((v) => !v)}
          style={{
            backgroundColor: showRare ? "#7c3aed" : "#fff",
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: showRare ? "#7c3aed" : "#e5e7eb",
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Text style={{ color: showRare ? "#fff" : "#374151", fontWeight: "600", fontSize: 13 }}>
            Nearby rare birds
          </Text>
        </Pressable>

        {isLoading && (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <ActivityIndicator size="small" color="#16a34a" />
          </View>
        )}
      </View>

      {/* Legend */}
      <View
        style={{
          position: "absolute",
          bottom: 32,
          right: 16,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" }} />
          <Text style={{ fontSize: 12, color: "#374151" }}>Your sightings</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#7c3aed" }} />
          <Text style={{ fontSize: 12, color: "#374151" }}>Rare nearby</Text>
        </View>
      </View>
    </View>
  );
}
