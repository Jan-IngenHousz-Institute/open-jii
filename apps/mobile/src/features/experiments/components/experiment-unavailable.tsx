import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

export function ExperimentUnavailable() {
  const { t } = useTranslation(["common", "experiments"]);

  return (
    <View className="items-center px-8 py-16">
      <Text className="text-on-surface font-poppins-bold text-center text-[17px]">
        {t("experiments:detail.unavailable")}
      </Text>
      <Text className="text-muted-body mt-2 text-center text-[13px]">
        {t("experiments:detail.unavailableHint")}
      </Text>
      <View className="mt-6">
        <Button title={t("common:back")} onPress={() => router.back()} variant="light" />
      </View>
    </View>
  );
}
