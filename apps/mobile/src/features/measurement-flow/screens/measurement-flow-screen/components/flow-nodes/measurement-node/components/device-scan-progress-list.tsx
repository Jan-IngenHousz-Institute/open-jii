import { clsx } from "clsx";
import { Check, CircleAlert } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { DeviceScanState } from "~/features/connection/hooks/use-multi-scanner";
import {
  mobileDevicePrimaryLabel,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface DeviceScanProgressListProps {
  deviceStates: DeviceScanState[];
}

export function DeviceScanProgressList({ deviceStates }: DeviceScanProgressListProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="w-full gap-2">
      {deviceStates.map(({ device, identity, status }) => {
        const presentation = presentMobileDevice(device, identity);
        const label = mobileDevicePrimaryLabel(
          presentation,
          t("connection:identity.unknownDevice"),
        );
        return (
          <View
            key={device.id}
            className="border-divider bg-card flex-row items-center gap-3 rounded-xl border px-3.5 py-2.5"
          >
            <Text className={clsx("flex-1 text-sm font-semibold", classes.text)} numberOfLines={1}>
              {label}
            </Text>
            {status === "scanning" ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : status === "done" ? (
              <View className="flex-row items-center gap-1.5">
                <Check size={16} color={colors.brand} />
                <Text className={clsx("text-xs", classes.textMuted)}>
                  {t("measurementFlow:measurementNode.multiScan.deviceDone")}
                </Text>
              </View>
            ) : status === "error" ? (
              <View className="flex-row items-center gap-1.5">
                <CircleAlert size={16} color={colors.semantic.error} />
                <Text className={clsx("text-xs", classes.textMuted)}>
                  {t("measurementFlow:measurementNode.multiScan.deviceFailed")}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
