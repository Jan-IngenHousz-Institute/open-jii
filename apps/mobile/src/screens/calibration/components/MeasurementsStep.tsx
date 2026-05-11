import React from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { colors } from "~/constants/colors";
import { useThemeColors } from "~/hooks/use-theme-colors";

interface MeasurementsStepProps {
  currentMeasurementIndex: number;
  totalMeasurements: number;
  currentPanelNumber: string | undefined;
  prompt: string;
  currentUserInput: string;
  isProcessing: boolean;
  progressPercentage: number;
  onUserInputChange: (value: string) => void;
  onTakeMeasurement: (panelNumber: number) => void;
  onCancelMeasurement: () => void;
}

export function MeasurementsStep({
  currentMeasurementIndex,
  totalMeasurements,
  currentPanelNumber,
  prompt,
  currentUserInput,
  isProcessing,
  progressPercentage,
  onUserInputChange,
  onTakeMeasurement,
  onCancelMeasurement,
}: MeasurementsStepProps) {
  const themeColors = useThemeColors();

  const handleTakeMeasurement = () => {
    if (currentPanelNumber) {
      onTakeMeasurement(parseInt(currentPanelNumber));
    }
  };

  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        Calibration Measurements ({currentMeasurementIndex + 1}/{totalMeasurements})
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">{prompt}</Text>

      <Card className="mb-6">
        <Text className="text-on-surface mb-3 text-base font-semibold">
          Panel #{currentPanelNumber} Value:
        </Text>
        {isProcessing ? (
          <View className="items-center justify-center py-6">
            <ActivityIndicator size="large" color={colors.primary.dark} />
          </View>
        ) : (
          <TextInput
            className="border-border bg-surface text-on-surface rounded-lg border p-3 text-base"
            value={currentUserInput}
            onChangeText={onUserInputChange}
            placeholder="Enter value"
            placeholderTextColor={themeColors.inactive}
            keyboardType="numeric"
          />
        )}
      </Card>

      {isProcessing ? (
        <Button
          title="Cancel Measurement"
          onPress={onCancelMeasurement}
          variant="outline"
          style={{ marginTop: 16, borderColor: "#e11d48" }}
          textStyle={{ color: "#e11d48" }}
        />
      ) : (
        <Button
          title="Start Measurement"
          onPress={handleTakeMeasurement}
          isDisabled={!currentUserInput.trim()}
          style={{ marginTop: 16 }}
        />
      )}

      <View className="mt-6">
        <View className="bg-border mb-2 h-2 rounded">
          <View
            className="bg-jii-primary h-full rounded"
            style={{ width: `${progressPercentage}%` }}
          />
        </View>
        <Text className="text-inactive text-center text-sm">
          {currentMeasurementIndex + 1} of {totalMeasurements} measurements completed
        </Text>
      </View>
    </View>
  );
}
