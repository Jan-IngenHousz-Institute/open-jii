import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

export function useMeasurementUpload({ experimentName, experimentId, protocolName }) {
  const { showToast } = useToast();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async (measurementResult: any) => {
      if (typeof measurementResult !== "object") return;
      const topic = getMultispeqMqttTopic({ experimentId, protocolName });
      try {
        await sendMqttEvent(topic, measurementResult);
        showToast("Measurement uploaded!", "success");
      } catch (e: any) {
        console.log("Upload failed", e);
        showToast("Upload not available, upload it later from Home screen", "error");
        await saveFailedUpload({
          topic,
          measurementResult,
          metadata: {
            experimentName,
            protocolName,
            timestamp: measurementResult.timestamp,
          },
        });
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
