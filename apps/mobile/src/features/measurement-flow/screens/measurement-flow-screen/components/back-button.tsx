import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const { t } = useTranslation("common");
  const themeColors = useThemeColors();

  // WORKAROUND: Key with timestamp to force remount on every render — bypasses
  // a native style caching bug in Expo SDK 54.
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      onPress={onPress}
      className="h-[44px] flex-row items-center justify-center gap-1 px-5"
    >
      <ChevronLeft size={20} color={themeColors.brand} />
      <Text className="text-primary text-lg font-medium">{t("common:back")}</Text>
    </TouchableOpacity>
  );
}
