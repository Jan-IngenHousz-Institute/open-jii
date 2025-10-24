import { router } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export function NoDeviceState() {
  return (
    <View className="items-center py-8">
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/")}
        className="rounded-lg border border-blue-500 bg-blue-50 px-4 py-2 dark:bg-blue-900/20"
      >
        <Text className="font-medium text-blue-600 dark:text-blue-400">
          Please connect to a device first
        </Text>
      </TouchableOpacity>
    </View>
  );
}
