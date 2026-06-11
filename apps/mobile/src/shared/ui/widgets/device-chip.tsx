import { Bluetooth, RotateCw } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export type DeviceChipState = "connected" | "last-known" | "never";

export interface DeviceChipProps {
  state: DeviceChipState;
  deviceName?: string;
  batteryLevel?: number;
  onPress: () => void;
}

// Presentational header chip; wire it with connection's useDeviceChip().
export function DeviceChip({ state, deviceName, batteryLevel, onPress }: DeviceChipProps) {
  const { t } = useTranslation("connection");
  const { warningFg } = useThemeColors();

  const baseClass = "mr-3 flex-row items-center gap-1.5 rounded-full border px-2.5";

  if (state === "connected") {
    return (
      <Pressable
        onPress={onPress}
        className={`${baseClass} bg-jii-mint border-jii-darker-green/15 dark:border-jii-primary-bright/20 h-7`}
        accessibilityRole="button"
      >
        <View className="bg-success h-1.5 w-1.5 rounded-full" />
        <Text
          className="text-jii-darker-green dark:text-jii-primary-bright text-[12px] font-semibold"
          numberOfLines={1}
        >
          {deviceName}
        </Text>
        {batteryLevel != null ? (
          <Text className="text-muted-body text-[12px]">{`${batteryLevel}%`}</Text>
        ) : null}
      </Pressable>
    );
  }

  const isLastKnown = state === "last-known";
  return (
    <Pressable
      onPress={onPress}
      className={`${baseClass} bg-jii-yellow-light border-jii-yellow/60 h-7`}
      accessibilityRole="button"
    >
      {isLastKnown ? (
        <RotateCw size={12} color={warningFg} />
      ) : (
        <Bluetooth size={12} color={warningFg} />
      )}
      <Text className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
        {isLastKnown ? t("chip.reconnect") : t("chip.connect")}
      </Text>
    </Pressable>
  );
}
