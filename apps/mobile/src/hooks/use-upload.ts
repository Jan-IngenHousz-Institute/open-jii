import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

interface UseUploadProps {
  experimentName: string;
  experimentId: string;
  protocolName: string;
  userId: string;
  macroFilename: string;
}

function prepareMeasurementForUpload(
  rawMeasurement: any,
  userId: string,
  macroFilename: string,
  timestamp: string,
) {
  if ("sample" in rawMeasurement && rawMeasurement.sample) {
    const samples = Array.isArray(rawMeasurement.sample)
      ? rawMeasurement.sample
      : [rawMeasurement.sample];

    for (const sample of samples) {
      sample.macros = macroFilename ? [macroFilename] : [];
    }
  }

  return {
    ...rawMeasurement,
    timestamp,
    userId,
  };
}

export function useUpload({
  experimentName,
  experimentId,
  protocolName,
  userId,
  macroFilename,
}: UseUploadProps) {
  const { showToast } = useToast();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async (rawMeasurement: any, timestamp: string) => {
      if (typeof rawMeasurement !== "object") return;

      // Prepare measurement data for upload (similar to processScan but without macro processing)
      const measurementData = prepareMeasurementForUpload(
        rawMeasurement,
        userId,
        macroFilename,
        timestamp,
      );

      const topic = getMultispeqMqttTopic({ experimentId, protocolName });

      try {
        await sendMqttEvent(topic, measurementData);
        showToast("Measurement uploaded!", "success");
      } catch (e: any) {
        console.log("Upload failed", e);
        showToast("Upload not available, upload it later from Home screen", "error");
        await saveFailedUpload({
          topic,
          measurementResult: measurementData,
          metadata: {
            experimentName,
            protocolName,
            timestamp: measurementData.timestamp,
          },
        });
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
