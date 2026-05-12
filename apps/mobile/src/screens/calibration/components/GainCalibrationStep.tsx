import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";

interface GainCalibrationStepProps {
  alertMessage: string;
  isProcessing: boolean;
  onStartGainCalibration: () => void;
}

export function GainCalibrationStep({
  alertMessage,
  isProcessing,
  onStartGainCalibration,
}: GainCalibrationStepProps) {
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        Gain Calibration (Auto-blanking)
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">{alertMessage}</Text>
      <Card className="mb-6">
        <Text className="text-on-surface text-base leading-[22px]">
          The device will now perform auto-blanking to establish baseline readings for each LED
          channel.
        </Text>
      </Card>
      <Button
        title={isProcessing ? "Calibrating..." : "Start Auto-blanking"}
        onPress={onStartGainCalibration}
        isLoading={isProcessing}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
