import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Animated } from "react-native";
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
import { C } from "@/lib/theme";

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (state.step === "recording") {
      pulseAnim.setValue(1);
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [state.step]);

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
    if (stopCalledRef.current) return;
    stopCalledRef.current = true;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }

    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) { setState({ step: "error", message: "No audio recorded" }); return; }

      setState({ step: "analyzing" });

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const result = await analyzeBirdAudio(uri, latitude, longitude);

      if (result.error) { setState({ step: "error", message: result.error }); return; }
      if (result.predictions.length === 0) {
        setState({ step: "error", message: "No birds detected. Try recording in a quieter spot with clear birdsong." });
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
      let species = prediction.species_code ? await findSpeciesByCode(prediction.species_code) : null;
      if (!species) species = await findSpeciesByName(prediction.common_name);

      if (!species) {
        setState({ step: "error", message: `Species "${prediction.common_name}" not found in database.` });
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

  function handleClose() { router.dismiss(); }

  function resetToIdle() {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    stopCalledRef.current = false;
    setState({ step: "idle" });
  }

  // ─── IDLE ─────────────────────────────────────────────────────────────────
  if (state.step === "idle") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
          <Pressable onPress={handleClose} style={{ alignSelf: "flex-end", paddingVertical: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 }}>
              CLOSE
            </Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: C.textPrimary, marginBottom: 8 }}>
              Listen for birds
            </Text>
            <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: 56, lineHeight: 22 }}>
              Hold your phone towards the birdsong.{"\n"}Recording lasts 12 seconds.
            </Text>

            {/* Record button with outer ring */}
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <View style={{
                width: 128,
                height: 128,
                borderRadius: 64,
                borderWidth: 1.5,
                borderColor: C.border,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Pressable
                  onPress={startRecording}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: C.green,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#080d09" }} />
                </Pressable>
              </View>
            </View>

            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 20, letterSpacing: 1, textTransform: "uppercase" }}>
              Tap to record
            </Text>
          </View>

          {/* Tip */}
          <View style={{
            backgroundColor: C.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Did you know
            </Text>
            <Text style={{ fontSize: 13, color: C.textSecondary, lineHeight: 20 }}>{DAILY_TIP}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── RECORDING ────────────────────────────────────────────────────────────
  if (state.step === "recording") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          {/* Pulsing record button */}
          <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
            <Animated.View style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: "#2d0707",
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pulseAnim }],
            }}>
              <View style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "#ef4444",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {/* Stop square */}
                <View style={{ width: 24, height: 24, borderRadius: 3, backgroundColor: "#fff" }} />
              </View>
            </Animated.View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: "800", color: C.textPrimary, marginBottom: 8 }}>
            Listening
          </Text>
          <Text style={{
            fontSize: 52,
            fontWeight: "800",
            color: "#ef4444",
            fontVariant: ["tabular-nums"],
            marginBottom: 12,
          }}>
            {state.seconds}
            <Text style={{ fontSize: 20, color: C.textMuted, fontWeight: "400" }}>s</Text>
          </Text>
          <Text style={{ color: C.textMuted, fontSize: 13, letterSpacing: 0.3 }}>
            Keep still — point towards the sound
          </Text>

          <Pressable
            onPress={stopRecording}
            style={{
              marginTop: 48,
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: C.textSecondary, fontWeight: "600", fontSize: 13 }}>Stop early</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── ANALYZING ────────────────────────────────────────────────────────────
  if (state.step === "analyzing") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.textPrimary, marginTop: 28, marginBottom: 8 }}>
            Identifying
          </Text>
          <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center" }}>
            Analysing audio with BirdNET
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (state.step === "results") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
          <Pressable onPress={handleClose} style={{ alignSelf: "flex-end", paddingVertical: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 }}>CLOSE</Text>
          </Pressable>

          <Text style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary, marginBottom: 6, marginTop: 12 }}>
            Detected
          </Text>
          <Text style={{ color: C.textSecondary, marginBottom: 24, fontSize: 14 }}>
            Tap a species to log it
          </Text>

          {state.predictions.map((pred, i) => {
            const logged = state.loggedNames.includes(pred.common_name);
            const confColor = pred.confidence >= 0.75 ? C.green : pred.confidence >= 0.5 ? "#fbbf24" : C.textMuted;
            const confBg = pred.confidence >= 0.75 ? C.greenFaint : pred.confidence >= 0.5 ? "#241100" : C.surface2;
            return (
              <Pressable
                key={i}
                onPress={() => !logged && confirmSpecies(pred, state)}
                style={{
                  backgroundColor: logged ? C.surface2 : C.surface,
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: logged ? C.border : C.borderBright,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: logged ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: logged ? C.textMuted : C.textPrimary }}>
                    {pred.common_name}
                  </Text>
                  {pred.scientific_name ? (
                    <Text style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 2 }}>
                      {pred.scientific_name}
                    </Text>
                  ) : null}
                </View>

                {logged ? (
                  <Text style={{ fontSize: 13, color: C.green, fontWeight: "700" }}>✓ Logged</Text>
                ) : (
                  <View style={{ backgroundColor: confBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: confColor }}>
                      {Math.round(pred.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          <Pressable onPress={resetToIdle} style={{ marginTop: 16, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: C.green, fontWeight: "600", fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── CONFIRMING ───────────────────────────────────────────────────────────
  if (state.step === "confirming") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.textPrimary, marginTop: 28, marginBottom: 8 }}>
            Logging sighting
          </Text>
          <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center" }}>
            {state.prediction.common_name}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── SUCCESS ──────────────────────────────────────────────────────────────
  if (state.step === "success") {
    const rarity = getRarity(state.pointsAwarded);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>

          {state.isNewSpecies && (
            <View style={{
              backgroundColor: "#241100",
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 5,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#fbbf24",
            }}>
              <Text style={{ color: "#fbbf24", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                New species
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 36, fontWeight: "800", color: C.textPrimary, textAlign: "center", lineHeight: 42, marginBottom: 6 }}>
            {state.commonName}
          </Text>
          {state.scientificName ? (
            <Text style={{ fontSize: 15, color: C.textMuted, fontStyle: "italic", marginBottom: 36 }}>
              {state.scientificName}
            </Text>
          ) : <View style={{ marginBottom: 36 }} />}

          {/* Points + rarity cards */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 40, width: "100%" }}>
            <View style={{
              flex: 1,
              backgroundColor: C.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              paddingVertical: 24,
              alignItems: "center",
            }}>
              <Text style={{ fontSize: 44, fontWeight: "800", color: C.gold, lineHeight: 48 }}>
                +{state.pointsAwarded}
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                points
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: rarity.bg,
              borderRadius: 10,
              paddingVertical: 24,
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: rarity.color }}>{rarity.label}</Text>
              <Text style={{ fontSize: 11, color: rarity.color, marginTop: 4, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>
                for your area
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setState({ step: "results", ...state.results })}
            style={{
              width: "100%",
              backgroundColor: C.green,
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#080d09", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 }}>
              Log another from this recording
            </Text>
          </Pressable>

          <Pressable onPress={handleClose} style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: C.textSecondary, fontWeight: "600", fontSize: 14 }}>Done</Text>
          </Pressable>

          <Pressable onPress={resetToIdle} style={{ paddingVertical: 8 }}>
            <Text style={{ color: C.green, fontWeight: "600", fontSize: 14 }}>Record something new</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "#2d0707",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}>
          <Text style={{ fontSize: 28 }}>✕</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.textPrimary, marginBottom: 12, textAlign: "center" }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 36 }}>
          {state.step === "error" ? state.message : "Unknown error"}
        </Text>

        <Pressable
          onPress={resetToIdle}
          style={{
            width: "100%",
            backgroundColor: C.green,
            borderRadius: 8,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "#080d09", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 }}>Try again</Text>
        </Pressable>
        <Pressable onPress={handleClose} style={{ paddingVertical: 12 }}>
          <Text style={{ color: C.textMuted, fontWeight: "600", fontSize: 14 }}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
