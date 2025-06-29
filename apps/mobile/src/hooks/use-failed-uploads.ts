import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import {
  getFailedUploadsWithKeys,
  removeFailedUpload,
  saveFailedUpload as rawSaveFailedUpload,
  FailedUpload,
} from "~/services/failed-uploads-storage";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";

export function useFailedUploads() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: uploads = [] } = useQuery({
    queryKey: ["failedUploads"],
    queryFn: async () => {
      const entries = await getFailedUploadsWithKeys();
      return entries.map(([key, data]) => ({ key, data }));
    },
  });

  const uploadAsync = useAsyncCallback(async () => {
    let lastError: any;
    for (const { key, data } of uploads) {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await removeFailedUpload(key);
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
        lastError = error;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
    if (lastError) {
      throw lastError;
    }
  });

  const uploadOne = async (key: string) => {
    const item = uploads.find((u) => u.key === key);
    if (!item) return;

    try {
      await sendMqttEvent(item.data.topic, item.data.measurementResult);
      await removeFailedUpload(key);
    } catch (error) {
      console.warn(`Failed to upload item with key ${key}:`, error);
      showToast("Failed to upload, try again later", "warning");
    }

    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
  };

  const saveFailedUpload = async (upload: FailedUpload) => {
    await rawSaveFailedUpload(upload);
    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
  };

  const handleRemoveFailedUpload = async (key: string) => {
    await removeFailedUpload(key);
    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
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
