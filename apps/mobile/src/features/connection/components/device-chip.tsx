import { Bluetooth, RotateCw } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useBatteryLevel } from "~/features/connection/hooks/use-battery-level";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function DeviceChip() {
  // Battery polling owns its own enabled-by-connectedDevice gate.

  const { data: connectedDevice } = useConnectedDevice();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);
  const batteryLevel = useBatteryLevel();
  const openSheet = useDeviceSheetStore((s) => s.open);
  const { t } = useTranslation("connection");
  const { warningFg } = useThemeColors();

  let state: "connected" | "last-known" | "never";
  if (connectedDevice) state = "connected";
  else if (lastConnectedDevice) state = "last-known";
  else state = "never";

  const baseClass = "mr-3 flex-row items-center gap-1.5 rounded-full border px-2.5";

  if (state === "connected" && connectedDevice) {
    return (
      <Pressable
        onPress={openSheet}
        className={`${baseClass} bg-jii-mint border-jii-darker-green/15 dark:border-jii-primary-bright/20 h-7`}
        accessibilityRole="button"
      >
        <View className="bg-success h-1.5 w-1.5 rounded-full" />
        <Text
          className="text-jii-darker-green dark:text-jii-primary-bright text-[12px] font-semibold"
          numberOfLines={1}
        >
          {connectedDevice.name}
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
      onPress={openSheet}
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
