import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function ProcessingStep() {
  const { t } = useTranslation(["common", "calibration"]);
  const { brand } = useThemeColors();
  return (
    <View className="flex-1">
      <Text className="text-on-surface mb-2 text-2xl font-bold">
        {t("calibration:processing.title")}
      </Text>
      <Text className="text-inactive mb-6 text-base leading-6">
        {t("calibration:processing.subtitle")}
      </Text>

      <Card className="items-center p-8">
        <ActivityIndicator size="large" color={brand} />
        <Text className="text-on-surface mt-4 text-center text-base">
          {t("calibration:processing.cardBody")}
        </Text>
      </Card>
    </View>
  );
}
