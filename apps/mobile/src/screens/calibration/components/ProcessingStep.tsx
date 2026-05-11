import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Card } from "~/components/Card";
import { useThemeColors } from "~/hooks/use-theme-colors";

export function ProcessingStep() {
  const { brand } = useThemeColors();
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">Processing Calibration Data</Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        Analyzing measurement data and calculating calibration parameters...
      </Text>

      <Card className="items-center p-8">
        <ActivityIndicator size="large" color={brand} />
        <Text className="text-on-surface mt-4 text-center text-base">
          Please wait while we process your calibration data
        </Text>
      </Card>
    </View>
  );
}
