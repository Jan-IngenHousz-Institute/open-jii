import React from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

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
  const { t } = useTranslation(["common", "calibration"]);
  const themeColors = useThemeColors();

  const handleTakeMeasurement = () => {
    if (currentPanelNumber) {
      onTakeMeasurement(parseInt(currentPanelNumber));
    }
  };

  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        {t("calibration:measurements.title", {
          current: currentMeasurementIndex + 1,
          total: totalMeasurements,
        })}
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">{prompt}</Text>

      <Card className="mb-6">
        <Text className="text-on-surface mb-3 text-base font-semibold">
          {t("calibration:measurements.panelLabel", { panel: currentPanelNumber })}
        </Text>
        {isProcessing ? (
          <View className="items-center justify-center py-6">
            <ActivityIndicator size="large" color={themeColors.brand} />
          </View>
        ) : (
          <TextInput
            className="border-border bg-surface text-on-surface rounded-lg border p-3 text-base"
            value={currentUserInput}
            onChangeText={onUserInputChange}
            placeholder={t("calibration:measurements.inputPlaceholder")}
            placeholderTextColor={themeColors.inactive}
            keyboardType="numeric"
          />
        )}
      </Card>

      {isProcessing ? (
        <Button
          title={t("calibration:measurements.cancelButton")}
          onPress={onCancelMeasurement}
          variant="danger"
          style={{ marginTop: 16 }}
        />
      ) : (
        <Button
          title={t("calibration:measurements.startButton")}
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
          {t("calibration:measurements.progress", {
            current: currentMeasurementIndex + 1,
            total: totalMeasurements,
          })}
        </Text>
      </View>
    </View>
  );
}
