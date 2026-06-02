import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "BirdQuest",
  slug: "birdquest",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  scheme: "birdquest",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.birdquest.app",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "BirdQuest uses the microphone to record birdsong for identification.",
      NSLocationWhenInUseUsageDescription:
        "BirdQuest uses your location to determine which birds are expected in your area.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1a1a2e",
    },
    package: "com.birdquest.app",
  },
  web: {
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-av",
      {
        microphonePermission:
          "BirdQuest uses the microphone to record birdsong for identification.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "BirdQuest uses your location to determine which birds are expected in your area.",
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    eas: {
      projectId: "",
    },
  },
});
