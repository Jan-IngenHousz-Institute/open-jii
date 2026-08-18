import { useCallback } from "react";
import { toast } from "sonner-native";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useAllMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useExportMeasurements } from "~/features/recent-measurements/hooks/use-export-measurements";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { UNSYNCED_STATUSES } from "~/shared/db/measurement-status";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { getMeasurementIdsByRunId } from "~/shared/db/measurements-storage";
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
  const { measurements, invalidate, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAllMeasurements(filter);
  const {
    uploadAll,
    uploadOne,
    uploadMany,
    removeMeasurement,
    removeMeasurements,
    clearSyncedMeasurements,
    updateMeasurementComment,
  } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);
  const { exportMeasurements } = useExportMeasurements();

  // The row/run callbacks are useCallback'd: the list screen's renderItem
  // hangs off them, and fresh identities would re-render every visible row.
  const confirmSync = useCallback(
    (m: MeasurementItem) =>
      confirmAndRun(t, {
        title: t("recentMeasurements:alerts.uploadMeasurementTitle"),
        message: t("recentMeasurements:alerts.uploadMeasurementMessage", {
          name: m.experimentName,
        }),
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
      }),
    [t, uploadOne, invalidate],
  );

  const confirmDelete = useCallback(
    (m: MeasurementItem) => {
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
          try {
            await removeMeasurement(m.key);
          } finally {
            invalidate();
          }
        },
      });
    },
    [t, removeMeasurement, invalidate],
  );

  // Run-level variants of the two row actions, so a collapsed run can be
  // uploaded or deleted without expanding it first. Membership is resolved
  // from storage by run id at action time: the rendered slice is only the
  // loaded, filter-matching, per-day rows, so acting on it would silently
  // miss run members hidden by a status filter, a midnight split, or an
  // unfetched page.
  const confirmSyncRun = useCallback(
    async (runId: string, experimentName: string) => {
      let keys: string[];
      try {
        keys = await getMeasurementIdsByRunId(runId, UNSYNCED_STATUSES);
      } catch {
        toast.error(t("recentMeasurements:alerts.uploadMeasurementError"));
        return;
      }
      if (keys.length === 0) {
        // The rendered run row is stale (its unsynced members settled since the
        // list loaded): refresh so the row drops or re-renders, instead of the
        // swipe silently doing nothing.
        invalidate();
        return;
      }
      confirmAndRun(t, {
        title: t("recentMeasurements:alerts.uploadRunTitle"),
        message: t("recentMeasurements:alerts.uploadRunMessage", {
          count: keys.length,
          name: experimentName,
        }),
        confirmText: t("recentMeasurements:alerts.uploadButton"),
        variant: "primary",
        errorMessage: t("recentMeasurements:alerts.uploadMeasurementError"),
        run: async () => {
          try {
            // Membership can drift while the confirmation is open (a settling
            // upload, a new measurement in the same run), so re-resolve instead
            // of acting on the pre-alert snapshot.
            const fresh = await getMeasurementIdsByRunId(runId, UNSYNCED_STATUSES);
            if (fresh.length > 0) await uploadMany(fresh);
          } finally {
            invalidate();
          }
        },
      });
    },
    [t, uploadMany, invalidate],
  );

  const confirmDeleteRun = useCallback(
    async (runId: string, experimentName: string) => {
      let keys: string[];
      try {
        keys = await getMeasurementIdsByRunId(runId);
      } catch {
        toast.error(t("recentMeasurements:alerts.deleteMeasurementError"));
        return;
      }
      if (keys.length === 0) {
        // See confirmSyncRun: a stale run row must not no-op silently.
        invalidate();
        return;
      }
      confirmAndRun(t, {
        title: t("recentMeasurements:alerts.deleteRunTitle"),
        message: t("recentMeasurements:alerts.deleteRunMessage", {
          count: keys.length,
          name: experimentName,
        }),
        confirmText: t("common:delete"),
        variant: "danger",
        errorMessage: t("recentMeasurements:alerts.deleteMeasurementError"),
        run: async () => {
          try {
            // Re-resolve on confirm, like confirmSyncRun.
            const fresh = await getMeasurementIdsByRunId(runId);
            if (fresh.length > 0) await removeMeasurements(fresh);
          } finally {
            invalidate();
          }
        },
      });
    },
    [t, removeMeasurements, invalidate],
  );

  // Count is supplied by the caller (the toolbar owns the counts subscription
  // now) so this hook stays off the per-settle re-render path.
  const confirmSyncAll = (unsyncedCount = 0) =>
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

  const confirmDeleteAllSynced = (syncedCount = 0) =>
    confirmAndRun(t, {
      title: t("recentMeasurements:alerts.deleteAllSyncedTitle"),
      message: t("recentMeasurements:alerts.deleteAllSyncedMessage", { count: syncedCount }),
      confirmText: t("common:delete"),
      variant: "danger",
      errorMessage: t("recentMeasurements:alerts.deleteAllSyncedError"),
      run: async () => {
        try {
          await clearSyncedMeasurements();
        } finally {
          invalidate();
        }
      },
    });

  const saveComment = async (m: StoredMeasurement, text: string) => {
    try {
      await updateMeasurementComment(m.id, m.data, text);
    } catch (err) {
      // Rethrown so the comment modal stays open (it only closes once the save
      // resolves) instead of losing the edit.
      toast.error(t("recentMeasurements:alerts.commentSaveError"));
      throw err;
    } finally {
      invalidate();
    }
  };

  return {
    measurements,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    confirmSync,
    confirmDelete,
    confirmSyncRun,
    confirmDeleteRun,
    confirmSyncAll,
    confirmDeleteAllSynced,
    handleExport: exportMeasurements,
    saveComment,
  };
}
