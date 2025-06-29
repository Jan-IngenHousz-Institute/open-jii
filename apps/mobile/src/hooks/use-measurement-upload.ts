import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

export function useMeasurementUpload({ experimentId, protocolName }) {
  const { showToast } = useToast();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async (measurementResult: object) => {
      if (typeof measurementResult !== "object") return;

      try {
        const topic = getMultispeqMqttTopic({ experimentId, protocolName });
        await sendMqttEvent(topic, measurementResult);
        showToast("Measurement uploaded!", "success");
      } catch (e: any) {
        console.log("Upload failed", e);
        showToast("Please check your internet connection and try again.", "error");
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
