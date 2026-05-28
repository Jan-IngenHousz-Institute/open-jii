import React from "react";
import { View } from "react-native";
import type { MeasurementFilter } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useMeasurementCounts } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useTranslation } from "~/shared/i18n";
import { TabBar } from "~/shared/ui/TabBar";

interface Props {
  filter: MeasurementFilter;
  onFilterChange: (filter: MeasurementFilter) => void;
}

export function MeasurementsToolbar({ filter, onFilterChange }: Props) {
  // Subscribe to counts inside the toolbar so settle-tick re-renders are
  // scoped to this small subtree, not the whole screen + FlashList.
  // See OJD-1470.
  const { syncedCount, unsyncedCount } = useMeasurementCounts();
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

  return (
    <View className="px-4 pt-2">
      <TabBar variant="underline" tabs={tabs} activeTab={filter} onTabChange={onFilterChange} />
    </View>
  );
}
