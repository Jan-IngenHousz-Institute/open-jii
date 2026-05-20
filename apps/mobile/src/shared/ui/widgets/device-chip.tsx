import { Bluetooth, RotateCw } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useBatteryPoller } from "~/features/connection/hooks/use-battery-poller";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";

export function DeviceChip() {
  // Battery polling owns its own enabled-by-connectedDevice gate.
  useBatteryPoller();

  const { data: connectedDevice } = useConnectedDevice();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);
  const batteryLevel = useDeviceConnectionStore((s) => s.batteryLevel);
  const openSheet = useDeviceSheetStore((s) => s.open);
  const { t } = useTranslation("connection");

  let state: "connected" | "last-known" | "never";
  if (connectedDevice) state = "connected";
  else if (lastConnectedDevice) state = "last-known";
  else state = "never";

  const baseClass = "mr-3 flex-row items-center gap-1.5 rounded-full border px-2.5";

  if (state === "connected" && connectedDevice) {
    return (
      <Pressable
        onPress={openSheet}
        className={`${baseClass} bg-jii-mint border-jii-darker-green/15`}
        style={{ height: 28 }}
        accessibilityRole="button"
      >
        <View
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: colors.semantic.success,
          }}
        />
        <Text
          className="text-[12px] font-semibold"
          style={{ color: colors.jii.darkerGreen }}
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
      className={`${baseClass} border-jii-yellow/60`}
      style={{ height: 28, backgroundColor: "#fff4d6" }}
      accessibilityRole="button"
    >
      {isLastKnown ? (
        <RotateCw size={12} color="#8a6800" />
      ) : (
        <Bluetooth size={12} color="#8a6800" />
      )}
      <Text className="text-[12px] font-semibold" style={{ color: "#8a6800" }}>
        {isLastKnown ? t("chip.reconnect") : t("chip.connect")}
      </Text>
    </Pressable>
  );
}
