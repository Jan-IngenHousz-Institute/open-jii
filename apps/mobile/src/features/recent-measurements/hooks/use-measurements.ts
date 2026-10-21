import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "~/features/recent-measurements/services/measurement-list-cache";
import { getOutbox } from "~/shared/composition/upload";
import {
  getMeasurementIds,
  getMeasurement,
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

import { useMeasurementViewer } from "./use-measurement-viewer";

// The row-action functions below are useCallback'd on [queryClient]:
// row-action callbacks in the list screen hang off these, and a new closure
// per render would break the memo on every visible row. (`uploadAll` feeds the
// toolbar instead and stays a plain closure.)
export function useMeasurements() {
  const viewer = useMeasurementViewer();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      getOutbox().enqueueMany(await getMeasurementIds(UNSYNCED_STATUSES, viewer));
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  const uploadOne = useCallback(
    async (key: string) => {
      if (await getMeasurement(key, viewer)) getOutbox().enqueue(key);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient, viewer],
  );

  // Whole workbook run: one enqueue burst, one invalidation.
  const uploadMany = useCallback(
    async (keys: readonly string[]) => {
      if (keys.length === 0) return;
      const visible = await Promise.all(keys.map((key) => getMeasurement(key, viewer)));
      getOutbox().enqueueMany(keys.filter((_, index) => visible[index]));
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient, viewer],
  );

  const saveMeasurement = useCallback(
    async (
      upload: Measurement,
      status: MeasurementStatus,
      owner?: { userId: string; isGuest: boolean | null } | null,
    ) => {
      const id = await saveMeasurementToStorage(upload, status, owner);
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
      await removeMeasurementFromStorage(key, viewer);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient, viewer],
  );

  const removeMeasurements = useCallback(
    async (keys: readonly string[]) => {
      if (keys.length === 0) return;
      await removeMeasurementsFromStorage(keys, viewer);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient, viewer],
  );

  const clearSyncedMeasurements = useCallback(async () => {
    const ids = await getMeasurementIds(["successful"], viewer);
    await removeMeasurementsFromStorage(ids, viewer);
    await queryClient.invalidateQueries({ queryKey: queryKeys.root });
  }, [queryClient, viewer]);

  const updateMeasurementComment = useCallback(
    async (key: string, data: Measurement, commentText: string) => {
      const flagType = getFlagTypeFromMeasurementResult(data.measurementResult);
      const annotations = buildAnnotations(commentText, flagType);
      const measurementResult = { ...data.measurementResult, annotations };
      await updateMeasurement(key, { ...data, measurementResult }, viewer);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
    [queryClient, viewer],
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
