import { Bluetooth, Radio, Usb } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  mobileDevicePrimaryLabel,
  mobileDeviceSecondaryParts,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useTranslation } from "~/shared/i18n";
import type { Device } from "~/shared/types/device";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

function pickIcon(device: Device, size: number, color: string) {
  if (device.type === "usb") return <Usb size={size} color={color} />;
  if (device.type === "bluetooth-classic") return <Bluetooth size={size} color={color} />;
  return <Radio size={size} color={color} />;
}

function signalKey(
  rssi: number | undefined,
): "signalStrong" | "signalMedium" | "signalWeak" | null {
  if (rssi == null) return null;
  if (rssi > -60) return "signalStrong";
  if (rssi > -75) return "signalMedium";
  return "signalWeak";
}

interface NearbyDeviceRowProps {
  device: Device;
  isConnecting: boolean;
  onConnect: (device: Device) => void;
  isLast: boolean;
}

export function NearbyDeviceRow({ device, isConnecting, onConnect, isLast }: NearbyDeviceRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("connection");

  const sigKey = signalKey(device.rssi);

  const presentation = presentMobileDevice(device);
  const title = mobileDevicePrimaryLabel(presentation, t("identity.unknownDevice"));
  const subParts = mobileDeviceSecondaryParts(presentation, {
    measurementDevice: t("identity.measurementDevice"),
    identifier: (id) => t("identity.identifier", { id }),
  });
  if (sigKey) subParts.push(t("deviceList.signal", { strength: t(`deviceList.${sigKey}`) }));
  const subtitle = subParts.join("  ·  ");

  return (
    <View
      className={[
        "flex-row items-center gap-3 py-3",
        !isLast ? "border-divider border-b" : "",
      ].join(" ")}
    >
      <View className="bg-jii-mint h-9 w-9 items-center justify-center rounded-xl">
        {pickIcon(device, 18, colors.jii.darkGreen)}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-on-surface text-[15px] font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isConnecting ? (
        <ActivityIndicator color={colors.jii.darkGreen} />
      ) : (
        <Button
          title={t("deviceSheet.connect")}
          variant="outline"
          size="sm"
          onPress={() => onConnect(device)}
        />
      )}
    </View>
  );
}
