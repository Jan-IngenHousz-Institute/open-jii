import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import type { DeviceScanState } from "~/features/connection/hooks/use-multi-scanner";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { DeviceScanProgressList } from "./device-scan-progress-list";

interface ScanningStateProps {
  protocolName?: string;
  deviceStates?: DeviceScanState[];
}

export function ScanningState({ protocolName, deviceStates }: ScanningStateProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const isMultiDevice = (deviceStates?.length ?? 0) > 1;

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className={clsx("text-center text-xl font-bold", classes.text)}>
        {isMultiDevice
          ? t("measurementFlow:measurementNode.multiScan.scanningOnCount", {
              count: deviceStates?.length,
            })
          : t("measurementFlow:measurementNode.scanning.title")}
      </Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}
      {isMultiDevice && deviceStates ? (
        <DeviceScanProgressList deviceStates={deviceStates} />
      ) : (
        <ActivityIndicator size="large" color={colors.brand} />
      )}
    </View>
  );
}
