import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";

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
  const { t } = useTranslation(["common", "calibration"]);

  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">{t("calibration:gain.title")}</Text>
      <Text className="text-inactive mb-6 text-base leading-6">{alertMessage}</Text>
      <Card className="mb-6">
        <Text className="text-on-surface text-base leading-[22px]">
          {t("calibration:gain.body")}
        </Text>
      </Card>
      <Button
        title={
          isProcessing ? t("calibration:gain.buttonProcessing") : t("calibration:gain.buttonIdle")
        }
        onPress={onStartGainCalibration}
        isLoading={isProcessing}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
