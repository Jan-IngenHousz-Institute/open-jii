import { Bluetooth, Usb } from "lucide-react-native";
import React from "react";
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
import { HomeNavCard } from "~/features/home/components/home-nav-card";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";

export function HomeDeviceCard() {
  const { t } = useTranslation("home");
  const { t: tConnection } = useTranslation("connection");
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
    // An unnamed device already leads with its stable identifier as the
    // primary label, so the subtitle carries no duplicating ID.
    title = t("device.reconnectTitle", {
      name: mobileDevicePrimaryLabel(presentation, tConnection("identity.unknownDevice")),
    });
    subtitle = t("device.reconnectSub");
  } else {
    title = t("device.disconnectedTitle");
    subtitle = t("device.disconnectedSub");
  }

  return (
    <HomeNavCard
      icon={<DeviceIcon size={22} color={isConnected ? colors.jii.darkGreen : "#8a6800"} />}
      iconTileClassName={isConnected ? "bg-jii-mint" : "bg-[#fff4d6]"}
      badge={isConnected ? "bottom-right" : undefined}
      badgeClassName="bg-[#09b732]"
      title={title}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
}
