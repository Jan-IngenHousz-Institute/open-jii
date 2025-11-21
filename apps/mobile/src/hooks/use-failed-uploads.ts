import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import {
  getFailedUploadsWithKeys,
  removeFailedUpload,
  saveFailedUpload as rawSaveFailedUpload,
  FailedUpload,
} from "~/services/failed-uploads-storage";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { saveSuccessfulUpload } from "~/services/successful-uploads-storage";

export function useFailedUploads() {
  const queryClient = useQueryClient();

  const { data: uploads = [] } = useQuery({
    queryKey: ["failedUploads"],
    queryFn: async () => {
      const entries = await getFailedUploadsWithKeys();
      return entries.map(([key, data]) => ({ key, data }));
    },
    networkMode: "always",
  });

  const uploadAsync = useAsyncCallback(async () => {
    let lastError: any;
    for (const { key, data } of uploads) {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        // Save as successful upload before removing from failed
        await saveSuccessfulUpload({
          topic: data.topic,
          measurementResult: data.measurementResult,
          metadata: data.metadata,
        });
        await removeFailedUpload(key);
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        lastError = error;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
    await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
    if (lastError) {
      throw lastError;
    }
  });

  const uploadOne = async (key: string) => {
    const item = uploads.find((u) => u.key === key);
    if (!item) return;

    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      // Save as successful upload before removing from failed
      await saveSuccessfulUpload({
        topic: item.data.topic,
        measurementResult: item.data.measurementResult,
        metadata: item.data.metadata,
      });
      await removeFailedUpload(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      toast.info("Failed to upload, try again later");
    }

    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
    await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
  };

  const saveFailedUpload = async (upload: FailedUpload) => {
    await rawSaveFailedUpload(upload);
    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
  };

  const handleRemoveFailedUpload = async (key: string) => {
    await removeFailedUpload(key);
    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
    await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
  };

  return {
    uploads,
    isUploading: uploadAsync.loading,
    uploadAll: uploadAsync.execute,
    uploadOne,
    saveFailedUpload,
    removeFailedUpload: handleRemoveFailedUpload,
  };
}
