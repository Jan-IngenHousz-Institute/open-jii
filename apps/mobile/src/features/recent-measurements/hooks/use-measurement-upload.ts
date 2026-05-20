import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { getUploadQueue } from "~/features/recent-measurements/services/upload-queue";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { compressSample } from "~/shared/utils/compress-sample";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

type TFn = ReturnType<typeof useTranslation>["t"];

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

function promptMeasurementFileSave(
  t: TFn,
  measurement: {
    topic: string;
    measurementResult: object;
    metadata: { experimentName: string; protocolName: string; timestamp: string };
  },
) {
  showAlert(
    t("recentMeasurements:alerts.saveErrorTitle"),
    t("recentMeasurements:alerts.saveErrorMessage"),
    [
      {
        text: t("recentMeasurements:alerts.saveToFileButton"),
        variant: "primary",
        onPress: () => {
          exportSingleMeasurementToFile(measurement).catch((exportError) => {
            console.error("Failed to export measurement to file:", exportError);
            toast.error(t("recentMeasurements:alerts.saveToFileError"));
          });
        },
      },
      { text: t("common:dismiss"), variant: "ghost" },
    ],
  );
}

export function useMeasurementUpload() {
  const { saveMeasurement } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    // Save runs locally; the UploadQueue handles offline/online itself, so
    // there's no reason to pause the mutation off-network.
    networkMode: "always",
    mutationFn: async ({
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
      if (typeof rawMeasurement !== "object") return;

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
      const measurement = {
        topic,
        measurementResult: measurementData,
        metadata: { experimentName, protocolName, timestamp: measurementData.timestamp },
      };

      let savedId: string;
      try {
        savedId = await saveMeasurement(measurement, "pending");
      } catch (storageError) {
        console.error("Failed to save measurement to local storage:", storageError);
        promptMeasurementFileSave(t, measurement);
        return;
      }

      getUploadQueue().enqueue(savedId);
      toast.info(t("recentMeasurements:toasts.savedQueued"));
    },
  });

  return { isUploading: mutation.isPending, uploadMeasurement: mutation.mutateAsync };
}
