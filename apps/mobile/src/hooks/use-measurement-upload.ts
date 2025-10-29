import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

interface PrepareMeasurementArgs {
  rawMeasurement: any;
  userId: string;
  macroFilename: string;
  timestamp: string;
  questions: AnswerData[];
}

function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macroFilename,
  timestamp,
  questions,
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
    questions,
    timestamp,
    userId,
    ...rawMeasurement,
  };
}

export function useMeasurementUpload() {
  const { showToast } = useToast();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async ({
      rawMeasurement,
      timestamp,
      experimentName,
      experimentId,
      protocolId,
      userId,
      macroFilename,
      questions,
    }: {
      rawMeasurement: any;
      timestamp: string;
      experimentName: string;
      experimentId: string;
      protocolId: string;
      userId: string;
      macroFilename: string;
      questions: AnswerData[];
    }) => {
      if (typeof rawMeasurement !== "object") {
        return;
      }

      const measurementData = prepareMeasurementForUpload({
        rawMeasurement,
        userId,
        macroFilename,
        timestamp,
        questions,
      });

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });

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
            protocolName: protocolId,
            timestamp: measurementData.timestamp,
          },
        });
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
