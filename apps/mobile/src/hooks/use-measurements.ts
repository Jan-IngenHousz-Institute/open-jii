import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { useUploadStore } from "~/stores/use-upload-store";
import { buildAnnotationsWithComment } from "~/utils/measurement-annotations";

export function useMeasurements() {
  const queryClient = useQueryClient();
  const { uploadingIds, isUploading, setIsUploading, addUploadingIds, removeUploadingId } =
    useUploadStore();
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
    const CONCURRENCY = 10;
    const items = [...failedUploads];
    setUploadProgress({ done: 0, total: items.length });
    setIsUploading(true);
    addUploadingIds(items.map(({ key }) => key));

    const taskFns = items.map(({ key, data }) => async () => {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await markAsSuccessful(key);
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        throw error;
      } finally {
        removeUploadingId(key);
        setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : null));
      }
    });

    let next = 0;
    const settled: PromiseSettledResult<void>[] = [];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, taskFns.length) }, async () => {
        while (next < taskFns.length) {
          const fn = taskFns[next++];
          try {
            await fn();
            settled.push({ status: "fulfilled", value: undefined });
          } catch (reason) {
            settled.push({ status: "rejected", reason });
          }
        }
      }),
    );
    const results = settled;

    setIsUploading(false);
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

    addUploadingIds([key]);
    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      await markAsSuccessful(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      toast.info("Failed to upload, try again later");
    } finally {
      removeUploadingId(key);
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
    isUploading,
    uploadAll: uploadAsync.execute,
    uploadOne,
    saveMeasurement,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
