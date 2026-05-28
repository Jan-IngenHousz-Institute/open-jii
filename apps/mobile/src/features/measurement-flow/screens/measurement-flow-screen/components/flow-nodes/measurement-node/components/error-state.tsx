import { AlertCircle } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface ErrorStateProps {
  error: any;
}

export function ErrorState({ error }: ErrorStateProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View
        className="mb-6 items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          backgroundColor: colors.semantic.error + "15",
        }}
      >
        <AlertCircle size={32} color={colors.semantic.error} />
      </View>
      <Text className="mb-3 text-center text-xl font-bold" style={{ color: colors.semantic.error }}>
        {t("measurementFlow:measurementNode.errorState.title")}
      </Text>
      <View
        className="w-full rounded-lg border px-4 py-3"
        style={{
          backgroundColor: colors.semantic.error + "10",
          borderColor: colors.semantic.error + "30",
        }}
      >
        <Text className="text-center text-base leading-6" style={{ color: colors.semantic.error }}>
          {error?.message ?? t("measurementFlow:measurementNode.errorState.fallbackMessage")}
        </Text>
      </View>
    </View>
  );
}
