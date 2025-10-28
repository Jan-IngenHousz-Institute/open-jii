import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

interface PrepareMeasurementArgs {
  rawMeasurement: any;
  userId: string;
  macroFilename: string;
  timestamp: string;
}

function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macroFilename,
  timestamp,
}: PrepareMeasurementArgs) {
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

interface UseUploadArgs {
  experimentName: string;
  experimentId: string;
  protocolName: string;
  userId: string;
  macroFilename: string;
}

export function useUpload({
  experimentName,
  experimentId,
  protocolName,
  userId,
  macroFilename,
}: UseUploadArgs) {
  const { showToast } = useToast();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async (rawMeasurement: any, timestamp: string) => {
      if (typeof rawMeasurement !== "object") {
        return;
      }

      const measurementData = prepareMeasurementForUpload({
        rawMeasurement,
        userId,
        macroFilename,
        timestamp,
      });

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
