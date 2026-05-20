import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";

export function DemoDisclaimer() {
  const { t } = useTranslation(["common", "calibration"]);

  return (
    <View className="mb-4 rounded-lg border border-orange-500 bg-orange-500/15 p-3 dark:bg-orange-500/20">
      <View className="mb-1 flex-row items-center">
        <Text className="text-warning mr-1.5 text-sm">⚠️</Text>
        <Text className="text-warning text-sm font-bold">
          {t("calibration:demoDisclaimer.badge")}
        </Text>
      </View>
      <Text className="text-xs leading-4 text-gray-900 dark:text-gray-100">
        {t("calibration:demoDisclaimer.body")}
      </Text>
    </View>
  );
}
