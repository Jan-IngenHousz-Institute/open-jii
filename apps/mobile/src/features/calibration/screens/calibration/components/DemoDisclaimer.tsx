import React from "react";
import { View, Text } from "react-native";

export function DemoDisclaimer() {
  return (
    <View className="mb-4 rounded-lg border border-orange-500 bg-orange-500/15 p-3 dark:bg-orange-500/20">
      <View className="mb-1 flex-row items-center">
        <Text className="text-warning mr-1.5 text-sm">⚠️</Text>
        <Text className="text-warning text-sm font-bold">Demo Mode</Text>
      </View>
      <Text className="text-xs leading-4 text-gray-900 dark:text-gray-100">
        This calibration flow is currently running in demonstration mode. All measurements and
        calculations are simulated for testing purposes only.
      </Text>
    </View>
  );
}
