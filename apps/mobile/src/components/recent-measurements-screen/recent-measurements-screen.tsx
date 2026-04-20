import { clsx } from "clsx";
import { UploadCloud, Trash2, Download } from "lucide-react-native";
import React, { useState } from "react";
import { View } from "react-native";
import { toast } from "sonner-native";
import { showAlert } from "~/components/AlertDialog";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import { MeasurementList } from "~/components/recent-measurements-screen/measurements-list";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type { MeasurementFilter } from "~/hooks/use-all-measurements";
import { useMeasurements } from "~/hooks/use-measurements";
import { useTheme } from "~/hooks/use-theme";
import { exportMeasurementsToFile } from "~/services/export-measurements";

const TABS = [
  { key: "all", label: "All" },
  { key: "synced", label: "Synced" },
  { key: "unsynced", label: "Unsynced" },
];

type TabKey = (typeof TABS)[number]["key"];

export function RecentMeasurementsScreen() {
  const { colors, classes } = useTheme();
  const [filter, setFilter] = useState<TabKey>("all");
  const { measurements, invalidate } = useAllMeasurements(filter as MeasurementFilter);
  const { uploadAll, isUploading, clearSyncedMeasurements } = useMeasurements();

  const unsyncedCount = measurements?.filter((m) => m.status === "unsynced").length ?? 0;
  const syncedCount = measurements?.filter((m) => m.status === "synced").length ?? 0;

  const handleSyncAll = () => {
    showAlert(
      "Upload All Measurements",
      `Are you sure you want to sync ${unsyncedCount} unsynced measurement${unsyncedCount !== 1 ? "s" : ""}?`,
      [
        {
          text: "Upload All",
          variant: "primary",
          onPress: () => {
            void (async () => {
              try {
                await uploadAll();
                toast.success("All measurements synced successfully");
                invalidate();
              } catch {
                toast.error("Sync failed. Please try again.");
              }
            })();
          },
        },
        {
          text: "Cancel",
          variant: "ghost",
        },
      ],
    );
  };

  const handleDeleteAllSynced = () => {
    showAlert(
      "Delete all synced measurements",
      `Are you sure you want to delete all ${syncedCount} synced measurements from local storage?`,
      [
        {
          text: "Delete",
          variant: "danger",
          onPress: () => {
            clearSyncedMeasurements()
              .then(() => {
                invalidate();
              })
              .catch(() => {
                toast.error("Failed to delete synced measurements");
              });
          },
        },
        {
          text: "Cancel",
          variant: "ghost",
        },
      ],
    );
  };

  const handleExport = () => {
    void exportMeasurementsToFile().catch(() => {
      toast.error("Export failed. Please try again.");
    });
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="flex-row items-center justify-between p-4">
        <TabBar tabs={TABS} activeTab={filter} onTabChange={setFilter} />

        <View className="flex-row gap-3">
          <Button
            variant="tertiary"
            onPress={handleDeleteAllSynced}
            isDisabled={syncedCount === 0}
            icon={<Trash2 size={24} color={colors.primary.dark} strokeWidth={1.4} />}
            style={{ borderColor: "transparent", padding: 9 }}
          />
          <Button
            variant="tertiary"
            onPress={handleSyncAll}
            isLoading={isUploading}
            isDisabled={unsyncedCount === 0}
            icon={<UploadCloud size={24} color={colors.primary.dark} strokeWidth={1.4} />}
            style={{ borderColor: "transparent", padding: 9 }}
          />
        </View>
      </View>

      <MeasurementList
        measurements={measurements}
        filter={filter}
        invalidate={invalidate}
        listFooter={
          <View className="px-4 pt-4">
            <Button
              title="Export measurements"
              variant="tertiary"
              onPress={handleExport}
              icon={<Download size={16} color={colors.primary.dark} strokeWidth={1.4} />}
            />
          </View>
        }
      />
    </View>
  );
}
