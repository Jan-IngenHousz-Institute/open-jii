import { toast } from "sonner-native";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useAllMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportMeasurementsToFile } from "~/features/recent-measurements/services/export-measurements";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";

type TFn = ReturnType<typeof useTranslation>["t"];

interface ConfirmConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: "primary" | "danger";
  errorMessage: string;
  run: () => Promise<void>;
}

function confirmAndRun(
  t: TFn,
  { title, message, confirmText, variant, errorMessage, run }: ConfirmConfig,
) {
  showAlert(title, message, [
    {
      text: confirmText,
      variant,
      onPress: () => {
        void run().catch(() => toast.error(errorMessage));
      },
    },
    { text: t("common:cancel"), variant: "ghost" },
  ]);
}

export function useRecentMeasurementsActions(filter: MeasurementFilter) {
  const { measurements, counts, invalidate, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAllMeasurements(filter);
  const {
    uploadAll,
    uploadOne,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  // Counts come from SQL — independent of the active filter.
  const unsyncedCount = counts.pending + counts.failed;
  const syncedCount = counts.successful;
  const totalCount = counts.pending + counts.failed + counts.successful;

  const confirmSync = (m: MeasurementItem) =>
    confirmAndRun(t, {
      title: t("recentMeasurements:alerts.uploadMeasurementTitle"),
      message: t("recentMeasurements:alerts.uploadMeasurementMessage", { name: m.experimentName }),
      confirmText: t("recentMeasurements:alerts.uploadButton"),
      variant: "primary",
      errorMessage: t("recentMeasurements:alerts.uploadMeasurementError"),
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
    confirmAndRun(t, {
      title: isSynced
        ? t("recentMeasurements:alerts.removeMeasurementTitle")
        : t("recentMeasurements:alerts.deleteMeasurementTitle"),
      message: isSynced
        ? t("recentMeasurements:alerts.removeMeasurementMessage", { name: m.experimentName })
        : t("recentMeasurements:alerts.deleteMeasurementMessage", { name: m.experimentName }),
      confirmText: isSynced ? t("recentMeasurements:alerts.removeButton") : t("common:delete"),
      variant: "danger",
      errorMessage: t("recentMeasurements:alerts.deleteMeasurementError"),
      run: async () => {
        await removeMeasurement(m.key);
        invalidate();
      },
    });
  };

  const confirmSyncAll = () =>
    confirmAndRun(t, {
      title: t("recentMeasurements:alerts.uploadAllTitle"),
      message: t("recentMeasurements:alerts.uploadAllMessage", { count: unsyncedCount }),
      confirmText: t("recentMeasurements:alerts.uploadAllButton"),
      variant: "primary",
      errorMessage: t("recentMeasurements:alerts.uploadAllError"),
      run: async () => {
        await uploadAll();
        invalidate();
      },
    });

  const confirmDeleteAllSynced = () =>
    confirmAndRun(t, {
      title: t("recentMeasurements:alerts.deleteAllSyncedTitle"),
      message: t("recentMeasurements:alerts.deleteAllSyncedMessage", { count: syncedCount }),
      confirmText: t("common:delete"),
      variant: "danger",
      errorMessage: t("recentMeasurements:alerts.deleteAllSyncedError"),
      run: async () => {
        await clearSyncedMeasurements();
        invalidate();
      },
    });

  const handleExport = () => {
    void exportMeasurementsToFile().catch(() => {
      toast.error(t("recentMeasurements:alerts.exportError"));
    });
  };

  const saveComment = async (m: StoredMeasurement, text: string) => {
    await updateMeasurementComment(m.id, m.data, text);
    invalidate();
  };

  return {
    measurements,
    hasAnyMeasurements: totalCount > 0,
    syncedCount,
    unsyncedCount,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    confirmSync,
    confirmDelete,
    confirmSyncAll,
    confirmDeleteAllSynced,
    handleExport,
    saveComment,
  };
}
