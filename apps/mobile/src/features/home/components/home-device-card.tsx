import { Bluetooth, ChevronRight, Usb } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useBatteryLevel } from "~/features/connection/hooks/use-battery-level";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import {
  mobileDevicePrimaryLabel,
  mobileDeviceSecondaryParts,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { cn } from "~/shared/ui/cn";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function HomeDeviceCard() {
  const { t } = useTranslation("home");
  const { t: tConnection } = useTranslation("connection");
  const themeColors = useThemeColors();
  const { data: connectedDevice } = useConnectedDevice();
  const batteryLevel = useBatteryLevel();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);
  const identity = useScannerCommandExecutorStore((s) =>
    connectedDevice ? s.executors.get(connectedDevice.id)?.identity : undefined,
  );

  const isConnected = !!connectedDevice;
  const DeviceIcon = connectedDevice?.type === "usb" ? Usb : Bluetooth;

  const onPress = () => useDeviceSheetStore.getState().open();

  let title: string;
  let subtitle: string;
  if (connectedDevice) {
    const presentation = presentMobileDevice(connectedDevice, identity);
    title = mobileDevicePrimaryLabel(presentation, tConnection("identity.unknownDevice"));
    const secondary = mobileDeviceSecondaryParts(presentation, {
      measurementDevice: tConnection("identity.measurementDevice"),
      identifier: (id) => tConnection("identity.identifier", { id }),
    });
    secondary.push(
      batteryLevel != null
        ? t("device.battery", { battery: batteryLevel })
        : t(
            connectedDevice.type === "bluetooth-classic"
              ? "device.connectedViaBluetooth"
              : "device.connectedViaCable",
          ),
    );
    subtitle = secondary.join(" · ");
  } else if (lastConnectedDevice) {
    const presentation = presentMobileDevice(lastConnectedDevice);
    title = t("device.reconnectTitle", {
      name: mobileDevicePrimaryLabel(presentation, tConnection("identity.unknownDevice")),
    });
    const identifier =
      presentation.provenance === "fallback" && presentation.id
        ? tConnection("identity.identifier", { id: presentation.id })
        : undefined;
    subtitle = [t("device.reconnectSub"), identifier].filter(Boolean).join(" · ");
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
            <DeviceIcon size={22} color={isConnected ? colors.jii.darkGreen : "#8a6800"} />
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
