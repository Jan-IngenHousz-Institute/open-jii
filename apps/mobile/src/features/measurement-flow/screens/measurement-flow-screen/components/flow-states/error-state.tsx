import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function ErrorState() {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className="text-destructive text-center">{t("measurementFlow:flowStates.error")}</Text>
    </View>
  );
}
