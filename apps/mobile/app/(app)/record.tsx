import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import { analyzeBirdAudio, type BirdNetPrediction } from "@/lib/birdnet";
import { findSpeciesByName, findSpeciesByCode, createSighting } from "@/lib/create-sighting";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { getRarity } from "@/lib/rarity";

type ResultsData = { predictions: BirdNetPrediction[]; audioUri: string; lat: number; lng: number; loggedNames: string[] };

type FlowState =
  | { step: "idle" }
  | { step: "recording"; seconds: number }
  | { step: "analyzing" }
  | ({ step: "results" } & ResultsData)
  | { step: "confirming"; prediction: BirdNetPrediction; audioUri: string; lat: number; lng: number }
  | { step: "success"; pointsAwarded: number; commonName: string; scientificName: string; isNewSpecies: boolean; results: ResultsData }
  | { step: "error"; message: string };

const BIRDING_TIPS = [
  "Dawn chorus (5–7am) is when birdsong is loudest — most species sing at once.",
  "A bird's song is territorial. The more complex, the healthier the male.",
  "Many birds memorise hundreds of different alarm calls from other species.",
  "The UK has over 600 recorded bird species, but only ~270 breed here.",
  "Robins are one of the only birds that sing year-round, including winter.",
  "Corvids (crows, jays, magpies) are among the most intelligent animals on Earth.",
  "Migrating birds navigate using the Earth's magnetic field, stars, and landmarks.",
];


const RECORDING_DURATION_MS = 12000;
const DAILY_TIP = BIRDING_TIPS[new Date().getDate() % BIRDING_TIPS.length];

export default function RecordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<FlowState>({ step: "idle" });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopCalledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setState({ step: "error", message: "Microphone permission required" });
        return;
      }

      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status !== "granted") {
        setState({ step: "error", message: "Location permission required to identify local species" });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      stopCalledRef.current = false;

      let seconds = 0;
      setState({ step: "recording", seconds: 0 });

      timerRef.current = setInterval(() => {
        seconds += 1;
        setState({ step: "recording", seconds });
      }, 1000);

      autoStopRef.current = setTimeout(() => stopRecording(), RECORDING_DURATION_MS);
    } catch (err) {
      setState({ step: "error", message: `Recording failed: ${(err as Error).message}` });
    }
  }

  async function stopRecording() {
    // Guard against double-stop (auto-stop timer + manual stop)
    if (stopCalledRef.current) return;
    stopCalledRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setState({ step: "error", message: "No audio recorded" });
        return;
      }

      setState({ step: "analyzing" });

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      const result = await analyzeBirdAudio(uri, latitude, longitude);

      if (result.error) {
        setState({ step: "error", message: result.error });
        return;
      }

      if (result.predictions.length === 0) {
        setState({ step: "error", message: "No birds detected. Try recording in a quieter area with clear birdsong." });
        return;
      }

      setState({
        step: "results",
        predictions: result.predictions.slice(0, 5),
        audioUri: uri,
        lat: latitude,
        lng: longitude,
        loggedNames: [],
      });
    } catch (err) {
      setState({ step: "error", message: `Analysis failed: ${(err as Error).message}` });
    }
  }

  async function confirmSpecies(prediction: BirdNetPrediction, resultsData: ResultsData) {
    if (!user) return;

    const { audioUri, lat, lng } = resultsData;
    setState({ step: "confirming", prediction, audioUri, lat, lng });

    try {
      let species = prediction.species_code
        ? await findSpeciesByCode(prediction.species_code)
        : null;
      if (!species) {
        species = await findSpeciesByName(prediction.common_name);
      }

      if (!species) {
        setState({ step: "error", message: `Species "${prediction.common_name}" not found in database. The species table may need more entries.` });
        return;
      }

      const verificationStatus = prediction.confidence >= 0.75 ? "auto_verified" as const : "casual" as const;

      const { count: priorCount } = await supabase
        .from("sightings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("species_id", species.id);
      const isNewSpecies = (priorCount ?? 0) === 0;

      const result = await createSighting({
        userId: user.id,
        speciesId: species.id,
        latitude: lat,
        longitude: lng,
        observedAt: new Date(),
        confidence: prediction.confidence,
        verificationStatus,
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["sightings"] });
      queryClient.invalidateQueries({ queryKey: ["species-count"] });

      setState({
        step: "success",
        pointsAwarded: result.points_awarded,
        commonName: species.common_name,
        scientificName: prediction.scientific_name,
        isNewSpecies,
        results: { ...resultsData, loggedNames: [...resultsData.loggedNames, species.common_name] },
      });
    } catch (err) {
      setState({ step: "error", message: `Failed to save sighting: ${(err as Error).message}` });
    }
  }

  function handleClose() {
    router.dismiss();
  }

  function resetToIdle() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    stopCalledRef.current = false;
    setState({ step: "idle" });
  }

  if (state.step === "idle") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
          <Pressable onPress={handleClose} style={{ alignSelf: "flex-end", paddingVertical: 8 }}>
            <Text style={{ color: "#6b7280", fontSize: 16 }}>Cancel</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48, marginBottom: 24 }}>🎙️</Text>
            <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
              Listen for birds
            </Text>
            <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 48, paddingHorizontal: 16 }}>
              Hold your phone towards the birdsong. Recording lasts 12 seconds.
            </Text>

            <Pressable
              onPress={startRecording}
              style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 30 }}>●</Text>
            </Pressable>
            <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 16 }}>Tap to record</Text>
          </View>

          <View style={{ backgroundColor: "#f0fdf4", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Did you know?
            </Text>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}>{DAILY_TIP}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "recording") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", marginBottom: 24, opacity: 0.8 }}>
            <Text style={{ color: "#fff", fontSize: 32 }}>●</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
            Listening...
          </Text>
          <Text style={{ fontSize: 32, fontFamily: "monospace", color: "#15803d", marginBottom: 16 }}>
            {state.seconds}s
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 14 }}>
            Keep still and point towards the sound
          </Text>

          <Pressable
            onPress={stopRecording}
            style={{ marginTop: 48, paddingHorizontal: 32, paddingVertical: 12, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12 }}
          >
            <Text style={{ color: "#4b5563", fontWeight: "500" }}>Stop early</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "analyzing") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "#111827", marginTop: 24, marginBottom: 8 }}>
            Identifying...
          </Text>
          <Text style={{ color: "#6b7280", fontSize: 16, textAlign: "center" }}>
            Sending audio to BirdNET for analysis
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "results") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
          <Pressable onPress={handleClose} style={{ alignSelf: "flex-end", paddingVertical: 8 }}>
            <Text style={{ color: "#6b7280", fontSize: 16 }}>Cancel</Text>
          </Pressable>

          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 8, marginTop: 16 }}>
            What we heard
          </Text>
          <Text style={{ color: "#6b7280", marginBottom: 24 }}>
            Tap a species to log it as a sighting
          </Text>

          {state.predictions.map((pred, i) => {
            const logged = state.loggedNames.includes(pred.common_name);
            return (
              <Pressable
                key={i}
                onPress={() => !logged && confirmSpecies(pred, state)}
                style={{ backgroundColor: logged ? "#f9fafb" : "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f3f4f6", flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: logged ? 0.6 : 1 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: logged ? "#9ca3af" : "#111827" }}>
                    {pred.common_name}
                  </Text>
                  {pred.scientific_name ? (
                    <Text style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>
                      {pred.scientific_name}
                    </Text>
                  ) : null}
                </View>
                {logged ? (
                  <Text style={{ fontSize: 14, color: "#16a34a", fontWeight: "600" }}>✓ Logged</Text>
                ) : (
                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
                    backgroundColor: pred.confidence >= 0.75 ? "#dcfce7" : pred.confidence >= 0.5 ? "#fef9c3" : "#f3f4f6",
                  }}>
                    <Text style={{
                      fontSize: 14, fontWeight: "600",
                      color: pred.confidence >= 0.75 ? "#15803d" : pred.confidence >= 0.5 ? "#a16207" : "#4b5563",
                    }}>
                      {Math.round(pred.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          <Pressable
            onPress={resetToIdle}
            style={{ marginTop: 16, paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ color: "#16a34a", fontWeight: "500" }}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "confirming") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "#111827", marginTop: 24, marginBottom: 8 }}>
            Logging sighting...
          </Text>
          <Text style={{ color: "#6b7280", fontSize: 16, textAlign: "center" }}>
            {state.prediction.common_name}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "success") {
    const rarity = getRarity(state.pointsAwarded);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 64, marginBottom: 12 }}>{state.isNewSpecies ? "🆕" : "🎉"}</Text>

          {state.isNewSpecies && (
            <View style={{ backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 10 }}>
              <Text style={{ color: "#854d0e", fontWeight: "700", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>
                New species!
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 26, fontWeight: "bold", color: "#111827", marginBottom: 2, textAlign: "center" }}>
            {state.commonName}
          </Text>
          {state.scientificName ? (
            <Text style={{ fontSize: 15, color: "#9ca3af", fontStyle: "italic", marginBottom: 20 }}>
              {state.scientificName}
            </Text>
          ) : <View style={{ marginBottom: 20 }} />}

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
            <View style={{ flex: 1, backgroundColor: "#f0fdf4", borderRadius: 14, paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ fontSize: 32, fontWeight: "bold", color: "#15803d" }}>+{state.pointsAwarded}</Text>
              <Text style={{ color: "#16a34a", fontSize: 13, marginTop: 2 }}>points</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 14, paddingVertical: 20, alignItems: "center", backgroundColor: rarity.bg }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: rarity.color }}>{rarity.label}</Text>
              <Text style={{ fontSize: 13, color: rarity.color, marginTop: 2, opacity: 0.8 }}>for your area</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setState({ step: "results", ...state.results })}
            style={{ width: "100%", backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Log another from this recording</Text>
          </Pressable>

          <Pressable
            onPress={handleClose}
            style={{ marginTop: 12, paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ color: "#6b7280", fontWeight: "500" }}>Done</Text>
          </Pressable>

          <Pressable
            onPress={resetToIdle}
            style={{ marginTop: 4, paddingVertical: 12 }}
          >
            <Text style={{ color: "#16a34a", fontWeight: "500" }}>Record another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 32 }}>
          {state.step === "error" ? state.message : "Unknown error"}
        </Text>

        <Pressable
          onPress={resetToIdle}
          style={{ width: "100%", backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 12 }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Try again</Text>
        </Pressable>
        <Pressable onPress={handleClose} style={{ paddingVertical: 12 }}>
          <Text style={{ color: "#6b7280", fontWeight: "500" }}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
