import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface OfflineBannerProps {
  online: boolean | undefined;
  checking: boolean;
  onRetry: () => void;
}

export function OfflineBanner({ online, checking, onRetry }: OfflineBannerProps) {
  const { warningFg } = useThemeColors();
  const { t } = useTranslation();
  if (online !== false) return null;
  return (
    <View className="bg-warning/10 mb-6 w-full gap-3 rounded-lg p-4">
      <View className="flex-row items-start gap-3" accessibilityLiveRegion="polite">
        <MaterialIcons name="wifi-off" size={24} color={warningFg} />
        <Text className="flex-1 text-base text-amber-800 dark:text-amber-200">
          {t("serverUnreachable")}
        </Text>
      </View>
      {checking && (
        <Text
          className="text-sm text-amber-800 dark:text-amber-200"
          accessibilityLiveRegion="polite"
        >
          {t("checkingConnection")}
        </Text>
      )}
      <Button
        title={t("tryAgain")}
        variant="surface"
        onPress={onRetry}
        isLoading={checking}
        accessibilityRole="button"
        accessibilityLabel={checking ? t("checkingConnection") : t("tryAgain")}
        accessibilityState={{ busy: checking, disabled: checking }}
      />
    </View>
  );
}
