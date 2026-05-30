import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    // The deep link URL contains the tokens as hash fragments
    // expo-router passes them as search params when using createURL
    const url = await Linking.getInitialURL();

    if (url) {
      // Extract tokens from the URL fragment
      const hashParams = new URLSearchParams(
        url.includes("#") ? url.split("#")[1] : ""
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          router.replace("/");
          return;
        }
      }
    }

    // If we have token_hash and type from email confirmation
    const tokenHash = params.token_hash as string | undefined;
    const type = params.type as string | undefined;

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "email",
      });

      if (!error) {
        router.replace("/");
        return;
      }
    }

    // Fallback: check if session exists (might have been set by auth listener)
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      router.replace("/");
    } else {
      // Failed — go back to login
      router.replace("/auth/login");
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <ActivityIndicator size="large" color="#16a34a" />
      <Text className="text-gray-500 mt-4">Signing you in...</Text>
    </View>
  );
}
