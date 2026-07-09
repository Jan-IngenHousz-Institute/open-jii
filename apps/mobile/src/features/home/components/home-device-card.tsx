import { Bluetooth, ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useBatteryLevel } from "~/features/connection/hooks/use-battery-level";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { cn } from "~/shared/ui/cn";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

const MAC_PATTERN = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

function macTail(id: string): string | null {
  if (!MAC_PATTERN.test(id)) return null;
  return id.split(/[:-]/).slice(-4).join(":");
}

export function HomeDeviceCard() {
  const { t } = useTranslation("home");
  const themeColors = useThemeColors();
  const { data: connectedDevice } = useConnectedDevice();
  const batteryLevel = useBatteryLevel();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);

  const isConnected = !!connectedDevice;

  const onPress = () => useDeviceSheetStore.getState().open();

  let title: string;
  let subtitle: string;
  if (isConnected) {
    const trimmedName = connectedDevice?.name.trim() ?? "";
    const isBt = connectedDevice?.type === "bluetooth-classic";
    const name = trimmedName.length > 0 ? trimmedName : "MultispeQ";
    const mac = isBt && connectedDevice ? macTail(connectedDevice.id) : null;
    title = mac ? `${name} (${mac})` : name;
    subtitle =
      batteryLevel != null
        ? t("device.connectedSub", { battery: batteryLevel })
        : t("device.connectedSubWithFirmware", {
            battery: "—",
            firmware: "—",
          }).replace(/Battery —% · /, "");
  } else if (lastConnectedDevice) {
    title = t("device.reconnectTitle", { name: lastConnectedDevice.name });
    subtitle = t("device.reconnectSub");
  } else {
    title = t("device.disconnectedTitle");
    subtitle = t("device.disconnectedSub");
  }

  return (
    <Pressable onPress={onPress} className="mb-1 mt-3">
      <View className="bg-card shadow-xs rounded-2xl p-3.5 shadow-black/10">
        <View className="flex-row items-center">
          <View
            className={cn(
              "h-13 w-13 relative mr-3 items-center justify-center rounded-[14px]",
              isConnected ? "bg-jii-mint" : "bg-[#fff4d6]",
            )}
          >
            <Bluetooth size={22} color={isConnected ? colors.jii.darkGreen : "#8a6800"} />
            {isConnected ? (
              <View className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#09b732]" />
            ) : null}
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="text-on-surface"
              style={{ fontFamily: "Poppins-Bold", fontSize: 15 }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <ChevronRight size={20} color={themeColors.inactive} />
        </View>
      </View>
    </Pressable>
  );
}
