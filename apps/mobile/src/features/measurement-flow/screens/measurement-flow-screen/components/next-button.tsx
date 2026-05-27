import clsx from "clsx";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface NextButtonProps {
  onPress: () => void;
  isDisabled?: boolean;
}

export function NextButton({ onPress, isDisabled = false }: NextButtonProps) {
  const { t } = useTranslation("measurementFlow");
  const { scheme } = useThemeColors();
  const iconColor = scheme === "dark" ? "#121212" : "#FFFFFF";

  // WORKAROUND: Key with timestamp to force remount on every render — bypasses
  // a native style caching bug in Expo SDK 54.
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      onPress={onPress}
      disabled={isDisabled}
      className={clsx(
        "bg-primary h-[44px] flex-row items-center justify-center gap-1 rounded-full px-5",
        isDisabled && "opacity-50",
      )}
    >
      <Text className="text-primary-foreground text-lg font-semibold">
        {t("measurementFlow:navigation.next")}
      </Text>
      <ChevronRight size={20} color={iconColor} />
    </TouchableOpacity>
  );
}
