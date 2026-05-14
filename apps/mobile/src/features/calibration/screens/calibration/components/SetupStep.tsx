import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

interface SetupStepProps {
  onStartCalibration: () => void;
}

export function SetupStep({ onStartCalibration }: SetupStepProps) {
  const { t } = useTranslation(["common", "calibration"]);

  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        {t("calibration:setup.title")}
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">{t("calibration:setup.intro")}</Text>
      <View className="mb-6">
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          {t("calibration:setup.bulletDevice")}
        </Text>
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          {t("calibration:setup.bulletCards")}
        </Text>
        <Text className="text-on-surface mb-2 text-base leading-[22px]">
          {t("calibration:setup.bulletReferences")}
        </Text>
      </View>
      <Button
        title={t("calibration:setup.startButton")}
        onPress={onStartCalibration}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
