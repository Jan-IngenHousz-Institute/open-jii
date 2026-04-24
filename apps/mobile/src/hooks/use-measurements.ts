import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import {
  clearMeasurements,
  getMeasurements,
  markAsSuccessful,
  removeMeasurement as removeMeasurementFromStorage,
  saveMeasurement as saveMeasurementToStorage,
  updateMeasurement,
  pruneExpiredMeasurements,
} from "~/services/measurements-storage";
import type { Measurement, MeasurementStatus } from "~/services/measurements-storage";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import {
  buildAnnotations,
  getFlagTypeFromMeasurementResult,
} from "~/utils/measurement-annotations";

export function useMeasurements() {
  const queryClient = useQueryClient();

  const { data: failedUploads = [] } = useQuery({
    queryKey: ["measurements", "failed"],
    queryFn: async () => {
      const entries = await getMeasurements("failed");
      return entries.map(([key, data]) => ({ key, data }));
    },
    networkMode: "always",
  });

  const uploadAsync = useAsyncCallback(async () => {
    let lastError: any;
    for (const { key, data } of failedUploads) {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await markAsSuccessful(key);
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        lastError = error;
      }
    }

    await pruneExpiredMeasurements();
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    if (lastError) {
      throw lastError;
    }
  });

  const uploadOne = async (key: string) => {
    const item = failedUploads.find((u) => u.key === key);
    if (!item) return;

    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      await markAsSuccessful(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      toast.info("Failed to upload, try again later");
    }

    await pruneExpiredMeasurements();
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const saveMeasurement = async (upload: Measurement, status: MeasurementStatus) => {
    await saveMeasurementToStorage(upload, status);
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
    isUploading: uploadAsync.loading,
    uploadAll: uploadAsync.execute,
    uploadOne,
    saveMeasurement,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
