import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUploadQueue } from "~/features/recent-measurements/services/upload-queue";
import {
  clearMeasurements,
  getMeasurements,
  markAsFailed,
  removeMeasurement as removeMeasurementFromStorage,
  saveMeasurement as saveMeasurementToStorage,
  updateMeasurement,
} from "~/shared/db/measurements-storage";
import type { Measurement, MeasurementStatus } from "~/shared/db/measurements-storage";
import {
  buildAnnotations,
  getFlagTypeFromMeasurementResult,
} from "~/shared/utils/measurement-annotations";

export function useMeasurements() {
  const queryClient = useQueryClient();

  // Both "pending" (never tried) and "failed" (tried, errored out) rows are
  // shown in the same "not on the cloud yet" view. Name kept for callsite
  // stability — semantically it's "everything not yet on the cloud."
  const { data: failedUploads = [] } = useQuery({
    queryKey: ["measurements", "pending-or-failed"],
    queryFn: async () => {
      const rows = await getMeasurements(["pending", "failed"]);
      return rows.map(({ id, data }) => ({ key: id, data }));
    },
    networkMode: "always",
  });

  const uploadMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const queue = getUploadQueue();
      const rows = await getMeasurements(["pending", "failed"]);
      for (const row of rows) queue.enqueue(row.id);
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    },
  });

  const uploadOne = async (key: string) => {
    getUploadQueue().enqueue(key);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const saveMeasurement = async (upload: Measurement, status: MeasurementStatus) => {
    const id = await saveMeasurementToStorage(upload, status);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    return id;
  };

  const markFailed = async (key: string) => {
    await markAsFailed(key);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const removeMeasurement = async (key: string) => {
    await removeMeasurementFromStorage(key);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const clearSyncedMeasurements = async () => {
    await clearMeasurements("successful");
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const updateMeasurementComment = async (key: string, data: Measurement, commentText: string) => {
    const flagType = getFlagTypeFromMeasurementResult(
      data.measurementResult as Record<string, unknown>,
    );
    const annotations = buildAnnotations(commentText, flagType);
    const measurementResult = { ...data.measurementResult, annotations };
    await updateMeasurement(key, { ...data, measurementResult });
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return {
    failedUploads,
    isUploading: uploadMutation.isPending,
    uploadAll: () => uploadMutation.mutateAsync(),
    uploadOne,
    saveMeasurement,
    markFailed,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
