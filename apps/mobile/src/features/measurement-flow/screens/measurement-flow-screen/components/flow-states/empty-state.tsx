import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function EmptyState() {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className={clsx("flex-1 justify-center rounded-t-3xl", classes.card, classes.border)}>
      <Text className={clsx("text-center", classes.textSecondary)}>
        {t("measurementFlow:flowStates.empty")}
      </Text>
    </View>
  );
}
