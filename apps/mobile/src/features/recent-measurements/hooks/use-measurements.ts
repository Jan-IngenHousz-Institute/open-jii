import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "~/features/recent-measurements/services/measurement-list-cache";
import { getOutbox } from "~/shared/composition/upload";
import {
  clearMeasurements,
  getMeasurements,
  markAsFailed,
  removeMeasurement as removeMeasurementFromStorage,
  removeMeasurements as removeMeasurementsFromStorage,
  saveMeasurement as saveMeasurementToStorage,
  updateMeasurement,
} from "~/shared/db/measurements-storage";
import type { Measurement, MeasurementStatus } from "~/shared/db/measurements-storage";
import { UNSYNCED_STATUSES } from "~/shared/db/measurements-storage";
import {
  buildAnnotations,
  getFlagTypeFromMeasurementResult,
} from "~/shared/measurements/measurement-annotations";

// The row-action functions below are useCallback'd on [queryClient]:
// row-action callbacks in the list screen hang off these, and a new closure
// per render would break the memo on every visible row. (`uploadAll` feeds the
// toolbar instead and stays a plain closure.)
export function useMeasurements() {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const outbox = getOutbox();
      const rows = await getMeasurements([...UNSYNCED_STATUSES]);
      for (const row of rows) outbox.enqueue(row.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  const uploadOne = useCallback(
    async (key: string) => {
      getOutbox().enqueue(key);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  // Whole workbook run: one enqueue burst, one invalidation.
  const uploadMany = useCallback(
    async (keys: readonly string[]) => {
      if (keys.length === 0) return;
      getOutbox().enqueueMany(keys);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  const saveMeasurement = useCallback(
    async (upload: Measurement, status: MeasurementStatus) => {
      const id = await saveMeasurementToStorage(upload, status);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
      return id;
    },
    [queryClient],
  );

  const markFailed = useCallback(
    async (key: string) => {
      await markAsFailed(key);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  const removeMeasurement = useCallback(
    async (key: string) => {
      await removeMeasurementFromStorage(key);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  const removeMeasurements = useCallback(
    async (keys: readonly string[]) => {
      if (keys.length === 0) return;
      await removeMeasurementsFromStorage(keys);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  const clearSyncedMeasurements = useCallback(async () => {
    await clearMeasurements("successful");
    await queryClient.invalidateQueries({ queryKey: queryKeys.root });
  }, [queryClient]);

  const updateMeasurementComment = useCallback(
    async (key: string, data: Measurement, commentText: string) => {
      const flagType = getFlagTypeFromMeasurementResult(data.measurementResult);
      const annotations = buildAnnotations(commentText, flagType);
      const measurementResult = { ...data.measurementResult, annotations };
      await updateMeasurement(key, { ...data, measurementResult });
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient],
  );

  return {
    isUploading: uploadMutation.isPending,
    uploadAll: () => uploadMutation.mutateAsync(),
    uploadOne,
    uploadMany,
    saveMeasurement,
    markFailed,
    removeMeasurement,
    removeMeasurements,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
