import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { showAlert } from "~/components/AlertDialog";
import { useMeasurements } from "~/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/services/export-measurements";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { compressSample } from "~/utils/compress-sample";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";
import { buildAnnotations } from "~/utils/measurement-annotations";

interface MacroInfo {
  id: string;
  name: string;
  filename: string;
}

interface PrepareMeasurementArgs {
  rawMeasurement: any;
  userId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
}

function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macro,
  timestamp,
  timezone,
  questions,
  commentText,
}: PrepareMeasurementArgs) {
  if ("sample" in rawMeasurement && rawMeasurement.sample) {
    const samples = Array.isArray(rawMeasurement.sample)
      ? rawMeasurement.sample
      : [rawMeasurement.sample];

    for (const sample of samples) {
      sample.macros = macro?.filename ? [macro.filename] : [];
    }
  }

  const macros: MacroInfo[] = macro ? [macro] : [];
  const annotations = buildAnnotations(commentText);

  const payload = {
    questions,
    macros,
    timestamp,
    timezone,
    user_id: userId,
    ...rawMeasurement,
    annotations,
  };

  // Compress the (large) sample field to reduce MQTT payload size.
  // The outer JSON envelope stays valid for AWS IoT Core SQL parsing.
  if (payload.sample != null) {
    payload.sample = compressSample(payload.sample);
    payload._sample_encoding = "gzip+base64";
  }

  return payload;
}

function promptMeasurementFileSave(measurement: {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}) {
  showAlert(
    "Something went wrong",
    "Could not save the measurement. Would you like to save it as a file instead?",
    [
      {
        text: "Save to File",
        variant: "primary",
        onPress: () => {
          exportSingleMeasurementToFile(measurement).catch((exportError) => {
            console.error("Failed to export measurement to file:", exportError);
            toast.error("Could not save measurement. Please try again.");
          });
        },
      },
      { text: "Dismiss", variant: "ghost" },
    ],
  );
}

export function useMeasurementUpload() {
  const { saveMeasurement } = useMeasurements();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async ({
      rawMeasurement,
      timestamp,
      timezone,
      experimentName,
      experimentId,
      protocolId,
      protocolName,
      userId,
      macro,
      questions,
      commentText,
    }: {
      rawMeasurement: any;
      timestamp: string;
      timezone: string;
      experimentName: string;
      experimentId: string;
      protocolId: string;
      protocolName: string;
      userId: string;
      macro: { id: string; name: string; filename: string } | null;
      questions: AnswerData[];
      commentText?: string;
    }) => {
      if (typeof rawMeasurement !== "object") {
        return;
      }

      const measurementData = prepareMeasurementForUpload({
        rawMeasurement,
        userId,
        macro,
        timestamp,
        timezone,
        questions,
        commentText,
      });

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });

      const failedUploadData = {
        topic,
        measurementResult: measurementData,
        metadata: {
          experimentName,
          protocolName,
          timestamp: measurementData.timestamp,
        },
      };

      try {
        await sendMqttEvent(topic, measurementData);
        toast.success("Measurement uploaded!");
        await saveMeasurement(failedUploadData, "successful");
        return;
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        toast.error("Upload not available, upload it later from Recent");
      }

      try {
        await saveMeasurement(failedUploadData, "failed");
      } catch (storageError) {
        console.error("Failed to save measurement to local storage:", storageError);
        promptMeasurementFileSave(failedUploadData);
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
