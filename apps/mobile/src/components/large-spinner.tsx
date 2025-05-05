import { ActivityIndicator, Text, View } from "react-native";

export function LargeSpinner({
  children = "Loading...",
}: {
  children?: string;
}) {
  return (
    <View className="w-full flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text className="mt-4 text-lg font-semibold text-gray-600">
        {children}
      </Text>
    </View>
  );
}
