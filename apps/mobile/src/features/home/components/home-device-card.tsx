import { Bluetooth, ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function HomeDeviceCard() {
  const { t } = useTranslation("home");
  const themeColors = useThemeColors();
  const { data: connectedDevice } = useConnectedDevice();
  const batteryLevel = useDeviceConnectionStore((s) => s.batteryLevel);
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);

  const isConnected = !!connectedDevice;

  const onPress = () => useDeviceSheetStore.getState().open();

  let title: string;
  let subtitle: string;
  if (isConnected) {
    title = connectedDevice?.name ?? "MultispeQ";
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
      <View className="bg-card rounded-2xl p-3.5 shadow-sm shadow-black/10">
        <View className="flex-row items-center">
          <View
            className="mr-3 items-center justify-center"
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: isConnected ? colors.jii.mint : "#fff4d6",
              position: "relative",
            }}
          >
            <Bluetooth size={22} color={isConnected ? colors.jii.darkGreen : "#8a6800"} />
            {isConnected ? (
              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: colors.semantic.success,
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                }}
              />
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
