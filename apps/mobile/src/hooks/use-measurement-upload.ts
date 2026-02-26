import { useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { saveSuccessfulUpload } from "~/services/successful-uploads-storage";
import { compressSample } from "~/utils/compress-sample";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";
import { buildAnnotationsWithComment } from "~/utils/measurement-annotations";

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
  questions: AnswerData[];
  commentText?: string;
}

function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macro,
  timestamp,
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
  const annotations = commentText ? buildAnnotationsWithComment(commentText) : [];

  const payload = {
    questions,
    macros,
    timestamp,
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

export function useMeasurementUpload() {
  const queryClient = useQueryClient();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async ({
      rawMeasurement,
      timestamp,
      experimentName,
      experimentId,
      protocolId,
      userId,
      macro,
      questions,
      commentText,
    }: {
      rawMeasurement: any;
      timestamp: string;
      experimentName: string;
      experimentId: string;
      protocolId: string;
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
        questions,
        commentText,
      });

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });

      try {
        await sendMqttEvent(topic, measurementData);
        toast.success("Measurement uploaded!");
        // Save successful upload for history
        await saveSuccessfulUpload({
          topic,
          measurementResult: measurementData,
          metadata: {
            experimentName,
            protocolName: protocolId,
            timestamp: measurementData.timestamp,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
      } catch (e: any) {
        console.log("Upload failed", e);
        toast.error("Upload not available, upload it later from Recent");
        await saveFailedUpload({
          topic,
          measurementResult: measurementData,
          metadata: {
            experimentName,
            protocolName: protocolId,
            timestamp: measurementData.timestamp,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
