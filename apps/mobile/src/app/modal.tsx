import { StatusBar } from "expo-status-bar";
import { Platform, Text, View } from "react-native";

export default function ModalScreen() {
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <Text className="text-foreground text-xl font-bold">Modal</Text>
      <View className="bg-divider my-8 h-px w-4/5" />
      <Text className="text-foreground">
        This is an example modal. You can edit it in app/modal.tsx.
      </Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}
