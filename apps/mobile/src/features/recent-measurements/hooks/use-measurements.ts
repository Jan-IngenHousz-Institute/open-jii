import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOutbox } from "~/shared/composition/upload";
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

// Standalone hook for callers that ONLY need the pending-or-failed list
// (e.g. the tab-bar icon badge). Mounting `useMeasurements` from those
// callers would also subscribe to the upload mutation and a host of
// unused query refs, all of which churn during heavy upload.
export function useFailedUploads() {
  const { data = [] } = useQuery({
    queryKey: ["measurements", "pending-or-failed"],
    queryFn: async () => {
      const rows = await getMeasurements(["pending", "failed"]);
      return rows.map(({ id, data }) => ({ key: id, data }));
    },
    networkMode: "always",
  });
  return data;
}

export function useMeasurements() {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const outbox = getOutbox();
      const rows = await getMeasurements(["pending", "failed"]);
      for (const row of rows) outbox.enqueue(row.id);
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    },
  });

  const uploadOne = async (key: string) => {
    getOutbox().enqueue(key);
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
