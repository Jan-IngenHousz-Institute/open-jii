import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Card } from "~/components/Card";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/use-theme";

export function ProcessingStep() {
  const { isDark } = useTheme();
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">Processing Calibration Data</Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        Analyzing measurement data and calculating calibration parameters...
      </Text>

      <Card className="items-center p-8">
        <ActivityIndicator
          size="large"
          color={isDark ? colors.primary.bright : colors.primary.dark}
        />
        <Text className="text-on-surface mt-4 text-center text-base">
          Please wait while we process your calibration data
        </Text>
      </Card>
    </View>
  );
}
