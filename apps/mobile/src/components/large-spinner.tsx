import { ActivityIndicator, Text, View } from "react-native";

export function LargeSpinner({
  children = "Loading...",
}: {
  children?: string;
}) {
  return (
    <View className="flex-1 justify-center items-center bg-white w-full">
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text className="text-lg font-semibold text-gray-600 mt-4">
        {children}
      </Text>
    </View>
  );
}
