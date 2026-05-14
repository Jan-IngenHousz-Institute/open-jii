import { Text, View } from "react-native";

export function ErrorView({ error }: { error: Error | string }) {
  const message = typeof error === "string" ? error : error.message;

  return (
    <View className="mx-4 mt-4 rounded-xl bg-red-500 px-4 py-3 shadow-lg">
      <Text className="text-center text-base font-semibold text-white">{message}</Text>
    </View>
  );
}
