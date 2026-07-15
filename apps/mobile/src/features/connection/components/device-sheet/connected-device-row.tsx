import { Bluetooth, Usb } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import type { Device } from "~/shared/types/device";
import { Button } from "~/shared/ui/Button";

interface ConnectedDeviceRowProps {
  device: Device;
  // Battery is tracked for the Primary device only (see CONTEXT.md).
  batteryLevel?: number;
  onDisconnect: (device: Device) => void;
}

export function ConnectedDeviceRow({
  device,
  batteryLevel,
  onDisconnect,
}: ConnectedDeviceRowProps) {
  const { t } = useTranslation("connection");
  const Icon = device.type === "bluetooth-classic" ? Bluetooth : Usb;

  return (
    <View className="bg-jii-mint-light border-jii-mint rounded-2xl border p-3.5">
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center"
          style={{ borderRadius: 14, backgroundColor: colors.jii.mint }}
        >
          <Icon size={22} color={colors.jii.darkGreen} />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-on-surface"
            style={{ fontFamily: "Poppins-Bold", fontSize: 15 }}
            numberOfLines={1}
          >
            {device.name}
          </Text>
          <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
            {batteryLevel != null
              ? t("deviceSheet.currentSubMultispeQNoFirmware", { battery: batteryLevel })
              : t(
                  device.type === "bluetooth-classic"
                    ? "deviceSheet.connectedViaBluetooth"
                    : "deviceSheet.connectedViaCable",
                )}
          </Text>
        </View>
        <Button
          title={t("deviceSheet.disconnect")}
          variant="ghost"
          size="sm"
          onPress={() => onDisconnect(device)}
        />
      </View>
    </View>
  );
}
