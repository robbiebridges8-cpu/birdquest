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

type FlowState =
  | { step: "idle" }
  | { step: "recording"; seconds: number }
  | { step: "analyzing" }
  | { step: "results"; predictions: BirdNetPrediction[]; audioUri: string; lat: number; lng: number }
  | { step: "confirming"; prediction: BirdNetPrediction; audioUri: string; lat: number; lng: number }
  | { step: "success"; pointsAwarded: number; commonName: string }
  | { step: "error"; message: string };

const RECORDING_DURATION_MS = 12000; // 12 seconds — BirdNET works best with 6-15s

export default function RecordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<FlowState>({ step: "idle" });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      let seconds = 0;
      setState({ step: "recording", seconds: 0 });

      timerRef.current = setInterval(() => {
        seconds += 1;
        setState({ step: "recording", seconds });
      }, 1000);

      // Auto-stop after duration
      setTimeout(() => stopRecording(), RECORDING_DURATION_MS);
    } catch (err) {
      setState({ step: "error", message: `Recording failed: ${(err as Error).message}` });
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setState({ step: "error", message: "No audio recorded" });
        return;
      }

      setState({ step: "analyzing" });

      // Get location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // Send to BirdNET
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
      });
    } catch (err) {
      setState({ step: "error", message: `Analysis failed: ${(err as Error).message}` });
    }
  }

  async function confirmSpecies(prediction: BirdNetPrediction, audioUri: string, lat: number, lng: number) {
    if (!user) return;

    setState({ step: "confirming", prediction, audioUri, lat, lng });

    try {
      // Look up species in our DB
      let species = prediction.species_code
        ? await findSpeciesByCode(prediction.species_code)
        : null;
      if (!species) {
        species = await findSpeciesByName(prediction.common_name);
      }

      if (!species) {
        setState({ step: "error", message: `Species "${prediction.common_name}" not found in database. The species table may need seeding.` });
        return;
      }

      // Determine verification status based on confidence
      const verificationStatus = prediction.confidence >= 0.75 ? "auto_verified" as const : "casual" as const;

      const result = await createSighting({
        userId: user.id,
        speciesId: species.id,
        latitude: lat,
        longitude: lng,
        observedAt: new Date(),
        confidence: prediction.confidence,
        verificationStatus,
      });

      // Invalidate profile to update points
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      setState({
        step: "success",
        pointsAwarded: result.points_awarded,
        commonName: species.common_name,
      });
    } catch (err) {
      setState({ step: "error", message: `Failed to save sighting: ${(err as Error).message}` });
    }
  }

  function handleClose() {
    router.back();
  }

  // --- RENDER ---

  if (state.step === "idle") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 px-6 pt-4">
          <Pressable onPress={handleClose} className="self-end py-2">
            <Text className="text-gray-500 text-base">Cancel</Text>
          </Pressable>

          <View className="flex-1 items-center justify-center">
            <Text className="text-5xl mb-6">🎙️</Text>
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              Listen for birds
            </Text>
            <Text className="text-base text-gray-500 text-center mb-12 px-4">
              Hold your phone towards the birdsong. Recording lasts 12 seconds.
            </Text>

            <Pressable
              onPress={startRecording}
              className="w-24 h-24 rounded-full bg-brand-600 items-center justify-center shadow-lg"
            >
              <Text className="text-white text-3xl">●</Text>
            </Pressable>
            <Text className="text-gray-400 text-sm mt-4">Tap to record</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "recording") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-32 h-32 rounded-full bg-red-500 items-center justify-center mb-6 opacity-80">
            <Text className="text-white text-4xl">●</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Listening...
          </Text>
          <Text className="text-4xl font-mono text-brand-700 mb-4">
            {state.seconds}s
          </Text>
          <Text className="text-gray-400 text-sm">
            Keep still and point towards the sound
          </Text>

          <Pressable
            onPress={stopRecording}
            className="mt-12 px-8 py-3 border border-gray-300 rounded-xl"
          >
            <Text className="text-gray-600 font-medium">Stop early</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "analyzing") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="text-xl font-bold text-gray-900 mt-6 mb-2">
            Identifying...
          </Text>
          <Text className="text-gray-500 text-base text-center">
            Sending audio to BirdNET for analysis
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "results") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 px-6 pt-4">
          <Pressable onPress={handleClose} className="self-end py-2">
            <Text className="text-gray-500 text-base">Cancel</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-gray-900 mb-2 mt-4">
            What we heard
          </Text>
          <Text className="text-gray-500 mb-6">
            Tap a species to log it as a sighting
          </Text>

          {state.predictions.map((pred, i) => (
            <Pressable
              key={i}
              onPress={() => confirmSpecies(pred, state.audioUri, state.lat, state.lng)}
              className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {pred.common_name}
                </Text>
                {pred.scientific_name ? (
                  <Text className="text-sm text-gray-400 italic">
                    {pred.scientific_name}
                  </Text>
                ) : null}
              </View>
              <View className={`px-3 py-1 rounded-full ${
                pred.confidence >= 0.75 ? "bg-brand-100" :
                pred.confidence >= 0.5 ? "bg-yellow-100" : "bg-gray-100"
              }`}>
                <Text className={`text-sm font-semibold ${
                  pred.confidence >= 0.75 ? "text-brand-700" :
                  pred.confidence >= 0.5 ? "text-yellow-700" : "text-gray-600"
                }`}>
                  {Math.round(pred.confidence * 100)}%
                </Text>
              </View>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setState({ step: "idle" })}
            className="mt-4 py-3 items-center"
          >
            <Text className="text-brand-600 font-medium">Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "confirming") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="text-xl font-bold text-gray-900 mt-6 mb-2">
            Logging sighting...
          </Text>
          <Text className="text-gray-500 text-base text-center">
            {state.prediction.common_name}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === "success") {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            {state.commonName}
          </Text>
          <View className="bg-brand-50 rounded-2xl px-8 py-6 items-center mb-8">
            <Text className="text-4xl font-bold text-brand-700">
              +{state.pointsAwarded}
            </Text>
            <Text className="text-brand-600 text-sm mt-1">points earned</Text>
          </View>

          <Pressable
            onPress={handleClose}
            className="w-full bg-brand-600 rounded-xl py-4 items-center"
          >
            <Text className="text-white text-base font-semibold">Done</Text>
          </Pressable>

          <Pressable
            onPress={() => setState({ step: "idle" })}
            className="mt-4 py-3"
          >
            <Text className="text-brand-600 font-medium">Record another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">😕</Text>
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </Text>
        <Text className="text-base text-gray-500 text-center mb-8">
          {state.step === "error" ? state.message : "Unknown error"}
        </Text>

        <Pressable
          onPress={() => setState({ step: "idle" })}
          className="w-full bg-brand-600 rounded-xl py-4 items-center mb-3"
        >
          <Text className="text-white text-base font-semibold">Try again</Text>
        </Pressable>
        <Pressable onPress={handleClose} className="py-3">
          <Text className="text-gray-500 font-medium">Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
