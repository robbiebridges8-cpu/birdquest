import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

export default function MapScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 36, marginBottom: 20 }}>🗺️</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 10, textAlign: "center" }}>
          Map needs a dev build
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
          Native maps aren't available in Expo Go.{"\n"}We'll set up EAS Build to enable this.
        </Text>
      </View>
    </SafeAreaView>
  );
}
