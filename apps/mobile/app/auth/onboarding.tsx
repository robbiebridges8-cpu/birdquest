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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: trimmed, display_name: trimmed })
      .eq("id", user.id);

    setLoading(false);

    if (updateError) {
      if (updateError.code === "23505") {
        setError("Username already taken");
      } else {
        setError(updateError.message);
      }
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["profile"] });
    router.replace("/(app)/home");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: "#14532d", marginBottom: 8 }}>
          Pick a username
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", marginBottom: 32, textAlign: "center" }}>
          This is how other birders will find you
        </Text>

        <TextInput
          style={{ width: "100%", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, marginBottom: 16, backgroundColor: "#fff" }}
          placeholder="e.g. robin_spotter"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {error && (
          <Text style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</Text>
        )}

        <Pressable
          onPress={handleSetUsername}
          disabled={loading || !username.trim()}
          style={{ width: "100%", backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: loading || !username.trim() ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              Continue
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
