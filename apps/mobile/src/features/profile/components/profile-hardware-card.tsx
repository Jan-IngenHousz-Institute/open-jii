import { Bluetooth, Cloud, Download } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import {
  mobileDevicePrimaryLabel,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import {
  useAllMeasurements,
  useMeasurementCounts,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useExportMeasurements } from "~/features/recent-measurements/hooks/use-export-measurements";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { formatTimeAgo } from "~/shared/time/format-time-ago";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";

export function ProfileHardwareCard() {
  const { t } = useTranslation("profile");
  const { t: tConnection } = useTranslation("connection");
  const { data: connectedDevice } = useConnectedDevice();
  const identity = useScannerCommandExecutorStore((s) =>
    connectedDevice ? s.executors.get(connectedDevice.id)?.identity : undefined,
  );
  const { unsyncedCount: queued } = useMeasurementCounts();
  const { measurements: allMeasurements } = useAllMeasurements("synced");
  const { exportMeasurements } = useExportMeasurements();

  const lastSynced = allMeasurements[0]?.timestamp;
  const lastSyncLabel = lastSynced ? formatTimeAgo(lastSynced) : "—";
  const dataSyncSub = lastSynced
    ? queued > 0
      ? t("hardware.dataSyncSubQueued", { count: queued, lastSync: lastSyncLabel })
      : t("hardware.dataSyncSubAllSynced", { lastSync: lastSyncLabel })
    : t("hardware.dataSyncSubNever");
  const connectedDeviceName = connectedDevice
    ? mobileDevicePrimaryLabel(
        presentMobileDevice(connectedDevice, identity),
        tConnection("identity.unknownDevice"),
      )
    : undefined;

  return (
    <View className="mb-4">
      <Text className="text-muted-body mb-2 px-1 text-[12px] font-bold uppercase tracking-wider">
        {t("hardware.section")}
      </Text>
      <Card padded={false}>
        <RowItem
          icon={<Bluetooth size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("hardware.devices")}
          subtitle={
            connectedDevice
              ? t("hardware.devicesSubConnected", { name: connectedDeviceName })
              : t("hardware.devicesSubDisconnected")
          }
          onPress={() => useDeviceSheetStore.getState().open()}
        />
        <RowItem
          icon={<Cloud size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("hardware.dataSync")}
          subtitle={dataSyncSub}
          onPress={exportMeasurements}
          right={<Download size={18} color={colors.jii.darkGreen} />}
          isLast
        />
      </Card>
    </View>
  );
}
