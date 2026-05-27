import { Trash2, UploadCloud } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { DeviceChip } from "~/shared/ui/widgets/device-chip";

interface Props {
  syncedCount: number;
  unsyncedCount: number;
  uploadingCount: number;
  isUploading: boolean;
  onSyncAll: () => void;
  onDeleteAllSynced: () => void;
}

export function MeasurementsHeaderActions({
  syncedCount,
  unsyncedCount,
  uploadingCount,
  isUploading,
  onSyncAll,
  onDeleteAllSynced,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const deleteDisabled = syncedCount === 0;
  const syncDisabled = unsyncedCount === 0 || isUploading;

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={onDeleteAllSynced}
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
          onPress={onSyncAll}
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
