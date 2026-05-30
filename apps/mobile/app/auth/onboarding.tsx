import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetUsername() {
    if (!username.trim() || !user) return;

    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setError("Only lowercase letters, numbers, and underscores");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: trimmed,
        display_name: trimmed,
      },
      { onConflict: "id" }
    );

    setLoading(false);

    if (upsertError) {
      if (upsertError.code === "23505") {
        setError("Username already taken");
      } else {
        setError(upsertError.message);
      }
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["profile"] });
    router.replace("/(app)/home");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 items-center justify-center bg-surface px-8">
        <Text className="text-3xl font-bold text-brand-900 mb-2">
          Pick a username
        </Text>
        <Text className="text-base text-gray-500 mb-8 text-center">
          This is how other birders will find you
        </Text>

        <TextInput
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base mb-4 bg-white"
          placeholder="e.g. robin_spotter"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {error && (
          <Text className="text-red-500 text-sm mb-4">{error}</Text>
        )}

        <Pressable
          onPress={handleSetUsername}
          disabled={loading || !username.trim()}
          className="w-full bg-brand-600 rounded-xl py-4 items-center disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">
              Continue
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
