import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
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
import {
  buildAnnotations,
  getFlagTypeFromMeasurementResult,
} from "~/utils/measurement-annotations";

export function useMeasurements() {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const uploadingKeysRef = useRef<Set<string>>(new Set());

  // Both "pending" (never tried) and "failed" (tried, errored) rows are
  // candidates for the next upload attempt. The variable retains its old
  // "failedUploads" name for callsite stability — semantically it's
  // "everything-not-yet-on-the-cloud."
  const { data: failedUploads = [] } = useQuery({
    queryKey: ["measurements", "pending-or-failed"],
    queryFn: async () => {
      const rows = await getMeasurements(["pending", "failed"]);
      return rows.map(({ id, data }) => ({ key: id, data }));
    },
    networkMode: "always",
  });

  const failedUploadsRef = useRef(failedUploads);
  failedUploadsRef.current = failedUploads;

  const uploadAsync = useAsyncCallback(async () => {
    // 3 keeps a single phone's burst well below AWS Cognito Identity Pool
    // throttling when multiple field devices come online at the same time.
    const CONCURRENCY = 3;
    const items = [...failedUploadsRef.current];

    const transitioned = new Set(await markAsUploading(items.map(({ key }) => key)));
    const itemsToUpload = items.filter(({ key }) => transitioned.has(key));
    setUploadProgress({ done: 0, total: itemsToUpload.length });
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });

    const taskFns = itemsToUpload.map(({ key, data }) => async () => {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await markAsSuccessful(key);
        queryClient.setQueryData(["measurements"], (old: MeasurementItem[] | undefined) =>
          old?.map((item) =>
            item.key === key ? { ...item, status: "successful" satisfies MeasurementStatus } : item,
          ),
        );
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        await markAsFailed(key);
        queryClient.setQueryData(["measurements"], (old: MeasurementItem[] | undefined) =>
          old?.map((item) =>
            item.key === key ? { ...item, status: "failed" satisfies MeasurementStatus } : item,
          ),
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
    if (uploadingKeysRef.current.has(key)) return;
    const item = failedUploads.find((u) => u.key === key);
    if (!item) return;

    uploadingKeysRef.current.add(key);

    try {
      const transitioned = await markAsUploading([key]);
      if (transitioned.length === 0) return;
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });

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
    } finally {
      uploadingKeysRef.current.delete(key);
    }
  };

  const saveMeasurement = async (upload: Measurement, status: MeasurementStatus) => {
    const id = await saveMeasurementToStorage(upload, status);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
    return id;
  };

  const markUploaded = async (key: string) => {
    await markAsSuccessful(key);
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
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
    uploadProgress,
    isUploading: uploadAsync.loading,
    uploadAll: uploadAsync.execute,
    uploadOne,
    saveMeasurement,
    markUploaded,
    markFailed,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  };
}
