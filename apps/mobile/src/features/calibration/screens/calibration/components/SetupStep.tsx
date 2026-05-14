import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/shared/ui/Button";

interface SetupStepProps {
  onStartCalibration: () => void;
}

export function SetupStep({ onStartCalibration }: SetupStepProps) {
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">Device Calibration Setup</Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        This calibration process will help ensure accurate device measurements. You'll need:
      </Text>
      <View className="mb-6">
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          • MultispeQ device connected
        </Text>
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          • Chlorophyll calibration cards (panels #2, #3, #4, #6, #7, #8, #10, #11, #12)
        </Text>
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          • Known reference values for each calibration card
        </Text>
      </View>
      <Button title="Start Calibration" onPress={onStartCalibration} style={{ marginTop: 16 }} />
    </View>
  );
}
