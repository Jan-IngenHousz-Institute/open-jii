import { Trash2, UploadCloud } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { DeviceChip } from "~/features/connection/components/device-chip";
import { useMeasurementCounts } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useOutboxSnapshot } from "~/features/recent-measurements/hooks/use-outbox-state";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface Props {
  onSyncAll: (unsyncedCount: number) => void;
  onDeleteAllSynced: (syncedCount: number) => void;
}

export function MeasurementsHeaderActions({ onSyncAll, onDeleteAllSynced }: Props) {
  // Subscribe to outbox progress AND counts here so settle-tick re-renders
  // are scoped to the header subtree, not the whole screen. See OJD-1470.
  const { count: uploadingCount, isUploading } = useOutboxSnapshot();
  const { syncedCount, unsyncedCount } = useMeasurementCounts();
  const { colors } = useTheme();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const deleteDisabled = syncedCount === 0;
  const syncDisabled = unsyncedCount === 0 || isUploading;

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => onDeleteAllSynced(syncedCount)}
        disabled={deleteDisabled}
        hitSlop={6}
        className="bg-jii-mint h-9 w-9 items-center justify-center rounded-full"
        style={{ opacity: deleteDisabled ? 0.4 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={t("recentMeasurements:toolbar.deleteAllSyncedAccessibilityLabel")}
        accessibilityHint={t("recentMeasurements:toolbar.deleteAllSyncedAccessibilityHint")}
      >
        <Trash2 size={18} color={colors.brand} strokeWidth={1.8} />
      </Pressable>
      <View className="relative">
        <Pressable
          onPress={() => onSyncAll(unsyncedCount)}
          disabled={syncDisabled}
          hitSlop={6}
          className="bg-jii-mint h-9 w-9 items-center justify-center rounded-full"
          style={{ opacity: syncDisabled ? 0.4 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={t("recentMeasurements:toolbar.syncAllAccessibilityLabel")}
          accessibilityHint={t("recentMeasurements:toolbar.syncAllAccessibilityHint")}
        >
          <UploadCloud size={18} color={colors.brand} strokeWidth={1.8} />
        </Pressable>
        {uploadingCount > 0 && (
          <View
            className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full px-1"
            style={{ backgroundColor: colors.semantic.info, height: 18 }}
          >
            <Text className="text-center text-[10px] font-bold text-white">{uploadingCount}</Text>
          </View>
        )}
      </View>
      <DeviceChip />
    </View>
  );
}
