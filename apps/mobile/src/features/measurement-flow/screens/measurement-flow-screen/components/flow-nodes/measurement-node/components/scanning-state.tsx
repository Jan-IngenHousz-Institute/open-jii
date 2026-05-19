import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface ScanningStateProps {
  protocolName?: string;
}

export function ScanningState({ protocolName }: ScanningStateProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className={clsx("text-center text-xl font-bold", classes.text)}>
        {t("measurementFlow:measurementNode.scanning.title")}
      </Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}
