import { Bluetooth, Cloud } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useAllMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";
import { formatTimeAgo } from "~/shared/utils/format-time-ago";

export function ProfileHardwareCard() {
  const { t } = useTranslation("profile");
  const { data: connectedDevice } = useConnectedDevice();
  const { counts } = useAllMeasurements("all");
  const { measurements: allMeasurements } = useAllMeasurements("synced");

  const lastSynced = allMeasurements[0]?.timestamp;
  const lastSyncLabel = lastSynced ? formatTimeAgo(lastSynced) : "—";

  const queued = counts.pending + counts.failed + counts.uploading;
  const dataSyncSub = lastSynced
    ? queued > 0
      ? t("hardware.dataSyncSubQueued", { count: queued, lastSync: lastSyncLabel })
      : t("hardware.dataSyncSubAllSynced", { lastSync: lastSyncLabel })
    : t("hardware.dataSyncSubNever");

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
              ? t("hardware.devicesSubConnected", { name: connectedDevice.name })
              : t("hardware.devicesSubDisconnected")
          }
          onPress={() => useDeviceSheetStore.getState().open()}
        />
        <RowItem
          icon={<Cloud size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("hardware.dataSync")}
          subtitle={dataSyncSub}
          isLast
        />
      </Card>
    </View>
  );
}
