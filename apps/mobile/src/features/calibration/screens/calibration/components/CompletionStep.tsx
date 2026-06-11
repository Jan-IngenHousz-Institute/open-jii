import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";

import { ProcessedCalibrationOutput } from "../../../domain/calibration-protocol";

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
  const { t } = useTranslation(["common", "calibration"]);

  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        {t("calibration:completion.title")}
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        {t("calibration:completion.subtitle")}
      </Text>

      <Card className="mb-6">
        <Text className="text-on-surface mb-4 text-lg font-bold">
          {t("calibration:completion.resultsHeading")}
        </Text>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-inactive text-base">
            {t("calibration:completion.measurementsTaken")}
          </Text>
          <Text className="text-on-surface text-base font-semibold">{measurements.length}</Text>
        </View>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-inactive text-base">
            {t("calibration:completion.calibrationQuality")}
          </Text>
          <Text className="text-success text-base font-semibold">
            {t("calibration:completion.qualityExcellent", {
              value: processedOutput?.maxR2 ?? 0.98,
            })}
          </Text>
        </View>
        {processedOutput && (
          <>
            <View className="mb-2 flex-row justify-between">
              <Text className="text-inactive text-base">{t("calibration:completion.offset")}</Text>
              <Text className="text-on-surface text-base font-semibold">
                {processedOutput.bestOffset}
              </Text>
            </View>
            <View className="mb-2 flex-row justify-between">
              <Text className="text-inactive text-base">{t("calibration:completion.slope")}</Text>
              <Text className="text-on-surface text-base font-semibold">
                {processedOutput.spadSlope}
              </Text>
            </View>
          </>
        )}
      </Card>

      <Button
        title={t("calibration:completion.startNewButton")}
        onPress={onStartNewCalibration}
        variant="outline"
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
