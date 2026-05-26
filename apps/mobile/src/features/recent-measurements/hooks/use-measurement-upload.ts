import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { compressSample } from "~/shared/utils/compress-sample";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { createLogger } from "~/shared/utils/logger";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

const log = createLogger("measurement-upload");

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
            log.error("Failed to export measurement to file", {
              err: (exportError as Error)?.message,
            });
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
    // Save runs locally; the Outbox handles offline/online itself, so
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
      // Reject malformed input instead of resolving as a no-op. `typeof
      // null === "object"` would otherwise slip a null through to
      // prepareMeasurementForUpload() and crash on `"sample" in null`, and a
      // silent success would let the flow advance with nothing saved.
      if (rawMeasurement === null || typeof rawMeasurement !== "object") {
        throw new Error(
          `Invalid rawMeasurement: expected object, got ${rawMeasurement === null ? "null" : typeof rawMeasurement}`,
        );
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
      const measurement = {
        topic,
        measurementResult: measurementData,
        metadata: { experimentName, protocolName, timestamp: measurementData.timestamp },
      };

      let savedId: string;
      try {
        savedId = await saveMeasurement(measurement, "pending");
      } catch (storageError) {
        log.error("Failed to save measurement to local storage", {
          err: (storageError as Error)?.message,
        });
        promptMeasurementFileSave(t, measurement);
        // Rethrow so callers awaiting uploadMeasurement(...) can distinguish a
        // failed local save from success and avoid advancing the flow with
        // nothing persisted.
        throw storageError;
      }

      getOutbox().enqueue(savedId);
      toast.info(t("recentMeasurements:toasts.savedQueued"));
    },
  });

  return { isUploading: mutation.isPending, uploadMeasurement: mutation.mutateAsync };
}
