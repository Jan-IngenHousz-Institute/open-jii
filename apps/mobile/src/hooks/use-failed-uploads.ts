import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import {
  getFailedUploadsWithKeys,
  removeFailedUpload,
  saveFailedUpload as rawSaveFailedUpload,
  FailedUpload,
} from "~/services/failed-uploads-storage";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";

export function useFailedUploads() {
  const queryClient = useQueryClient();

  const { data: uploads = [] } = useQuery({
    queryKey: ["failedUploads"],
    queryFn: async () => {
      const entries = await getFailedUploadsWithKeys();
      console.log("entries", entries);
      return entries.map(([key, data]) => ({ key, data }));
    },
  });

  const uploadAsync = useAsyncCallback(async () => {
    for (const { key, data } of uploads) {
      try {
        await sendMqttEvent(data.topic, data.measurementResult);
        await removeFailedUpload(key);
      } catch (error) {
        console.warn(`Failed to upload item with key ${key}:`, error);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
  });

  const saveFailedUpload = async (upload: FailedUpload) => {
    await rawSaveFailedUpload(upload);
    await queryClient.invalidateQueries({ queryKey: ["failedUploads"] });
  };

  return {
    uploads,
    isUploading: uploadAsync.loading,
    uploadAll: uploadAsync.execute,
    saveFailedUpload,
  };
}
