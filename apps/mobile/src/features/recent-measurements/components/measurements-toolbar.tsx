import { FlaskConical, Trash2, UploadCloud } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { MeasurementFilter } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useMeasurementCounts } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useOutboxSnapshot } from "~/features/recent-measurements/hooks/use-outbox-state";
import { useTranslation } from "~/shared/i18n";
import { TabBar } from "~/shared/ui/TabBar";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface Props {
  filter: MeasurementFilter;
  onFilterChange: (filter: MeasurementFilter) => void;
  onSyncAll: (unsyncedCount: number) => void;
  onDeleteAllSynced: (syncedCount: number) => void;
  onDevSeed?: () => void;
}

export function MeasurementsToolbar({
  filter,
  onFilterChange,
  onSyncAll,
  onDeleteAllSynced,
  onDevSeed,
}: Props) {
  // Subscribe to outbox progress AND counts inside the toolbar so settle-tick
  // re-renders are scoped to this small subtree, not the whole screen +
  // FlashList. See OJD-1470.
  const { count: uploadingCount, isUploading } = useOutboxSnapshot();
  const { syncedCount, unsyncedCount } = useMeasurementCounts();
  const { colors } = useTheme();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const tabs: { key: MeasurementFilter; label: string; count: number }[] = [
    {
      key: "all",
      label: t("recentMeasurements:filters.all"),
      count: syncedCount + unsyncedCount,
    },
    {
      key: "synced",
      label: t("recentMeasurements:filters.synced"),
      count: syncedCount,
    },
    {
      key: "unsynced",
      label: t("recentMeasurements:filters.unsynced"),
      count: unsyncedCount,
    },
  ];

  const deleteDisabled = syncedCount === 0;
  const syncDisabled = unsyncedCount === 0 || isUploading;

  return (
    <View>
      {/* Action row: icons sit above the tabs so the tab labels never collide
          with the right-hand controls on narrow screens. */}
      <View className="flex-row items-center justify-end gap-1 px-2 pb-1 pt-2">
        {__DEV__ && onDevSeed && (
          <Pressable
            onPress={onDevSeed}
            hitSlop={6}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Seed measurements (DEV)"
          >
            <FlaskConical size={20} color={colors.brand} strokeWidth={1.6} />
          </Pressable>
        )}
        <Pressable
          onPress={() => onDeleteAllSynced(syncedCount)}
          disabled={deleteDisabled}
          hitSlop={6}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ opacity: deleteDisabled ? 0.4 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={t("recentMeasurements:toolbar.deleteAllSyncedAccessibilityLabel")}
          accessibilityHint={t("recentMeasurements:toolbar.deleteAllSyncedAccessibilityHint")}
        >
          <Trash2 size={20} color={colors.brand} strokeWidth={1.6} />
        </Pressable>
        <View className="relative">
          <Pressable
            onPress={() => onSyncAll(unsyncedCount)}
            disabled={syncDisabled}
            hitSlop={6}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ opacity: syncDisabled ? 0.4 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={t("recentMeasurements:toolbar.syncAllAccessibilityLabel")}
            accessibilityHint={t("recentMeasurements:toolbar.syncAllAccessibilityHint")}
          >
            <UploadCloud size={20} color={colors.brand} strokeWidth={1.6} />
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
      </View>

      {/* Tabs row: full width, no contention with the action icons. */}
      <View className="px-4">
        <TabBar variant="underline" tabs={tabs} activeTab={filter} onTabChange={onFilterChange} />
      </View>
    </View>
  );
}
