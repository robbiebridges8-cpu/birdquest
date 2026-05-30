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
import * as Linking from "expo-linking";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUrl = Linking.createURL("auth/callback");

  async function handleSendLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-8">
        <Text className="text-3xl font-bold text-brand-900 mb-4">
          Check your email
        </Text>
        <Text className="text-base text-gray-600 text-center mb-8">
          We sent a magic link to{"\n"}
          <Text className="font-semibold">{email}</Text>
        </Text>
        <Pressable onPress={() => setSent(false)}>
          <Text className="text-brand-600 text-base font-medium">
            Use a different email
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 items-center justify-center bg-surface px-8">
        <Text className="text-4xl font-bold text-brand-900 mb-2">
          BirdQuest
        </Text>
        <Text className="text-base text-gray-500 mb-12">
          Log birds. Earn points. Explore.
        </Text>

        <TextInput
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base mb-4 bg-white"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />

        {error && (
          <Text className="text-red-500 text-sm mb-4">{error}</Text>
        )}

        <Pressable
          onPress={handleSendLink}
          disabled={loading || !email.trim()}
          className="w-full bg-brand-600 rounded-xl py-4 items-center disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">
              Send magic link
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
