import { Text, View } from "react-native";

export function ErrorView({ error }: { error: Error | string }) {
  const message = typeof error === "string" ? error : error.message;

  return (
    <View className="rounded-lg border border-red-300 bg-red-100 p-3">
      <Text className="font-bold text-red-800">⚠️ {message}</Text>
    </View>
  );
}
