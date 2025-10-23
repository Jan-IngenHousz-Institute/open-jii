import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function MeasurementFlowScreen() {
  const theme = useTheme();

  return (
    <View className="flex-1 bg-white p-5 dark:bg-gray-900">
      <View className="flex-1 items-center justify-center px-5">
        <Text className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-white">
          Measurement Flow
        </Text>
        <Text className="mb-6 text-center text-lg leading-6 text-gray-600 dark:text-gray-400">
          This is your new measurement flow screen. We'll add functionality here in the next steps.
        </Text>
        <Text className="text-center text-base leading-6 text-gray-600 opacity-80 dark:text-gray-400">
          This screen will provide enhanced measurement capabilities and workflow management for
          your plant science experiments.
        </Text>
      </View>
    </View>
  );
}
