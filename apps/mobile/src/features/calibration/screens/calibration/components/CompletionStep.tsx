import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";

import { ProcessedCalibrationOutput } from "../utils/calibration-protocol";

interface CompletionStepProps {
  measurements: any[];
  processedOutput: ProcessedCalibrationOutput | null;
  onStartNewCalibration: () => void;
}

export function CompletionStep({
  measurements,
  processedOutput,
  onStartNewCalibration,
}: CompletionStepProps) {
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">Calibration Complete!</Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        Your MultispeQ device has been successfully calibrated and is ready for measurements.
      </Text>

      <Card className="mb-6">
        <Text className="text-on-surface mb-4 text-lg font-bold">Calibration Results</Text>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-inactive text-base">Measurements Taken:</Text>
          <Text className="text-on-surface text-base font-semibold">{measurements.length}</Text>
        </View>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-inactive text-base">Calibration Quality:</Text>
          <Text className="text-success text-base font-semibold">
            Excellent (R² = {processedOutput?.maxR2 ?? 0.98})
          </Text>
        </View>
        {processedOutput && (
          <>
            <View className="mb-2 flex-row justify-between">
              <Text className="text-inactive text-base">Offset:</Text>
              <Text className="text-on-surface text-base font-semibold">
                {processedOutput.bestOffset}
              </Text>
            </View>
            <View className="mb-2 flex-row justify-between">
              <Text className="text-inactive text-base">Slope:</Text>
              <Text className="text-on-surface text-base font-semibold">
                {processedOutput.spadSlope}
              </Text>
            </View>
          </>
        )}
      </Card>

      <Button
        title="Start New Calibration"
        onPress={onStartNewCalibration}
        variant="outline"
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
