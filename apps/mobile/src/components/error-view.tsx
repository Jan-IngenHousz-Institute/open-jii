import { Text, View } from "react-native";

export function ErrorView({ error }: { error: Error | string }) {
  const message = typeof error === "string" ? error : error.message;

  return (
    <View className="bg-red-100 p-3 rounded-lg border border-red-300">
      <Text className="text-red-800 font-bold">⚠️ {message}</Text>
    </View>
  );
}
