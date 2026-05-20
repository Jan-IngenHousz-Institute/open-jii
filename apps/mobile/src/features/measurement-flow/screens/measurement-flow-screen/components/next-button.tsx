import clsx from "clsx";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";

interface NextButtonProps {
  onPress: () => void;
  isDisabled?: boolean;
}

export function NextButton({ onPress, isDisabled = false }: NextButtonProps) {
  const { t } = useTranslation("measurementFlow");

  // WORKAROUND: Key with timestamp to force remount on every render — bypasses
  // a native style caching bug in Expo SDK 54.
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      onPress={onPress}
      disabled={isDisabled}
      className={clsx(
        "bg-jii-yellow h-[44px] flex-row items-center justify-center gap-1 rounded-full px-5 shadow-sm shadow-black/10",
        isDisabled && "opacity-50",
      )}
    >
      <Text className="text-lg font-semibold" style={{ color: colors.jii.darkerGreen }}>
        {t("measurementFlow:navigation.next")}
      </Text>
      <ChevronRight size={20} color={colors.jii.darkerGreen} />
    </TouchableOpacity>
  );
}
