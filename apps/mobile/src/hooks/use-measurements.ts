import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import {
  clearMeasurements,
  getMeasurements,
  markAsFailed,
  markAsSuccessful,
  markAsUploading,
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

  const failedUploadsRef = useRef(failedUploads);
  failedUploadsRef.current = failedUploads;

  const uploadAsync = useAsyncCallback(async () => {
    const CONCURRENCY = 10;
    const items = [...failedUploadsRef.current];
    setUploadProgress({ done: 0, total: items.length });

    await markAsUploading(items.map(({ key }) => key));
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });

    const taskFns = items.map(({ key, data }) => async () => {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await markAsSuccessful(key);
        queryClient.setQueryData(
          ["measurements"],
          (old: { key: string; status: string }[] | undefined) =>
            old?.map((item) => (item.key === key ? { ...item, status: "synced" } : item)),
        );
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        await markAsFailed(key);
        queryClient.setQueryData(
          ["measurements"],
          (old: { key: string; status: string }[] | undefined) =>
            old?.map((item) => (item.key === key ? { ...item, status: "unsynced" } : item)),
        );
        throw error;
      } finally {
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

    setUploadProgress(null);
    await pruneExpiredMeasurements();
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });

    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (rejected.length > 0) {
      throw rejected[rejected.length - 1].reason;
    }
  });

  const uploadOne = async (key: string) => {
    const item = failedUploads.find((u) => u.key === key);
    if (!item) return;

    await markAsUploading([key]);
    queryClient.invalidateQueries({ queryKey: ["measurements"] });

    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      await markAsSuccessful(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      await markAsFailed(key);
      toast.info("Failed to upload, try again later");
    } finally {
      await pruneExpiredMeasurements();
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    }
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
