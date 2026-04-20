import { useState } from "react";
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
import { buildAnnotationsWithComment } from "~/utils/measurement-annotations";

export function useMeasurements() {
  const queryClient = useQueryClient();
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const { data: failedUploads = [] } = useQuery({
    queryKey: ["measurements", "failed"],
    queryFn: async () => {
      const entries = await getMeasurements("failed");
      return entries.map(([key, data]) => ({ key, data }));
    },
    networkMode: "always",
  });

  const uploadAsync = useAsyncCallback(async () => {
    const items = [...failedUploads];
    setUploadProgress({ done: 0, total: items.length });
    setUploadingIds(new Set(items.map(({ key }) => key)));

    const results = await Promise.allSettled(
      items.map(async ({ key, data }) => {
        try {
          await sendMqttEvent(data.topic, data.measurementResult);
          await markAsSuccessful(key);
        } catch (error) {
          console.warn(`Failed to upload item with key ${key}:`, error);
          throw error;
        } finally {
          setUploadingIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : null));
        }
      }),
    );

    setUploadProgress(null);
    await pruneExpiredMeasurements();
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });

    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (rejected.length > 0) {
      throw rejected[rejected.length - 1].reason;
    }
  });

  const uploadOne = async (key: string) => {
    const item = failedUploads.find((u) => u.key === key);
    if (!item) return;

    setUploadingIds((prev) => new Set([...prev, key]));
    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      await markAsSuccessful(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      toast.info("Failed to upload, try again later");
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
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
    const annotations = buildAnnotationsWithComment(commentText);
    const measurementResult = { ...data.measurementResult, annotations };
    await updateMeasurement(key, { ...data, measurementResult });
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return {
    failedUploads,
    uploadingIds,
    uploadProgress,
    isUploading: uploadAsync.loading,
    uploadAll: uploadAsync.execute,
    uploadOne,
    saveMeasurement,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
