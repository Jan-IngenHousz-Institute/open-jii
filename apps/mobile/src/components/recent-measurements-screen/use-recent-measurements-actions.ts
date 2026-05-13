import { toast } from "sonner-native";
import { showAlert } from "~/components/AlertDialog";
import type { MeasurementFilter, MeasurementItem } from "~/hooks/use-all-measurements";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import { useMeasurements } from "~/hooks/use-measurements";
import { exportMeasurementsToFile } from "~/services/export-measurements";

interface ConfirmConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: "primary" | "danger";
  errorMessage: string;
  run: () => Promise<void>;
}

function confirmAndRun({ title, message, confirmText, variant, errorMessage, run }: ConfirmConfig) {
  showAlert(title, message, [
    {
      text: confirmText,
      variant,
      onPress: () => {
        void run().catch(() => toast.error(errorMessage));
      },
    },
    { text: "Cancel", variant: "ghost" },
  ]);
}

export function useRecentMeasurementsActions(filter: MeasurementFilter) {
  const { measurements, counts, uploadingCount, invalidate } = useAllMeasurements(filter);
  const {
    uploadAll,
    isUploading,
    uploadOne,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  } = useMeasurements();

  // Counts come from SQL — independent of the active filter.
  const unsyncedCount = counts.pending + counts.failed;
  const syncedCount = counts.successful;
  const totalCount = counts.pending + counts.failed + counts.uploading + counts.successful;

  const confirmSync = (m: MeasurementItem) =>
    confirmAndRun({
      title: "Upload Measurement",
      message: `Are you sure you want to upload "${m.experimentName}"?`,
      confirmText: "Upload",
      variant: "primary",
      errorMessage: "Failed to upload measurement. Please try again.",
      run: async () => {
        try {
          await uploadOne(m.key);
        } finally {
          invalidate();
        }
      },
    });

  const confirmDelete = (m: MeasurementItem) => {
    const isSynced = m.status === "successful";
    confirmAndRun({
      title: isSynced ? "Delete Measurement" : "Remove Measurement",
      message: isSynced
        ? `Are you sure you want to delete "${m.experimentName}" from local storage?`
        : `Are you sure you want to remove "${m.experimentName}"? This will delete it from local storage.`,
      confirmText: isSynced ? "Delete" : "Remove",
      variant: "danger",
      errorMessage: "Failed to delete measurement. Please try again.",
      run: async () => {
        await removeMeasurement(m.key);
        invalidate();
      },
    });
  };

  const confirmSyncAll = () =>
    confirmAndRun({
      title: "Upload All Measurements",
      message: `Are you sure you want to sync ${unsyncedCount} unsynced measurement${unsyncedCount !== 1 ? "s" : ""}?`,
      confirmText: "Upload All",
      variant: "primary",
      errorMessage: "Sync failed. Please try again.",
      run: async () => {
        await uploadAll();
        toast.success("All measurements synced successfully");
        invalidate();
      },
    });

  const confirmDeleteAllSynced = () =>
    confirmAndRun({
      title: "Delete all synced measurements",
      message: `Are you sure you want to delete all ${syncedCount} synced measurements from local storage?`,
      confirmText: "Delete",
      variant: "danger",
      errorMessage: "Failed to delete synced measurements",
      run: async () => {
        await clearSyncedMeasurements();
        invalidate();
      },
    });

  const handleExport = () => {
    void exportMeasurementsToFile().catch(() => {
      toast.error("Export failed. Please try again.");
    });
  };

  const saveComment = async (m: MeasurementItem, text: string) => {
    await updateMeasurementComment(m.key, m.data, text);
    invalidate();
  };

  return {
    measurements,
    hasAnyMeasurements: totalCount > 0,
    syncedCount,
    unsyncedCount,
    uploadingCount,
    isUploading,
    confirmSync,
    confirmDelete,
    confirmSyncAll,
    confirmDeleteAllSynced,
    handleExport,
    saveComment,
  };
}
