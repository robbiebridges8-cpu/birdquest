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
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        router.replace("/");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
      } else {
        router.replace("/");
      }
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 36, fontWeight: "bold", color: "#14532d", marginBottom: 8 }}>
          BirdQuest
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", marginBottom: 48 }}>
          Log birds. Earn points. Explore.
        </Text>

        <TextInput
          style={{ width: "100%", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, marginBottom: 16, backgroundColor: "#fff" }}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />

        <TextInput
          style={{ width: "100%", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, marginBottom: 16, backgroundColor: "#fff" }}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {error && (
          <Text style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</Text>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={loading || !email.trim() || !password.trim()}
          style={{ width: "100%", backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: loading || !email.trim() || !password.trim() ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {isSignUp ? "Sign up" : "Sign in"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setIsSignUp(!isSignUp); setError(null); }} style={{ marginTop: 16 }}>
          <Text style={{ color: "#16a34a", fontSize: 16, fontWeight: "500" }}>
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
