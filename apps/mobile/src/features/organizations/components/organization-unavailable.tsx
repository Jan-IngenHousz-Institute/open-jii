import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

export function OrganizationUnavailable() {
  const { t } = useTranslation(["common", "organizations"]);

  return (
    <View className="items-center px-8 py-16">
      <Text
        className="text-on-surface text-center"
        style={{ fontFamily: "Poppins-Bold", fontSize: 17 }}
      >
        {t("organizations:detail.unavailable")}
      </Text>
      <Text className="text-muted-body mt-2 text-center text-[13px]">
        {t("organizations:detail.unavailableHint")}
      </Text>
      <View className="mt-6">
        <Button title={t("common:back")} onPress={() => router.back()} variant="light" />
      </View>
    </View>
  );
}
