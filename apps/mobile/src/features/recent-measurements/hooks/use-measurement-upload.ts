import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { v4 as uuidv4 } from "uuid";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";
import { showAlert } from "~/shared/ui/AlertDialog";

const log = createLogger("measurement-upload");

type TFn = ReturnType<typeof useTranslation>["t"];

interface MacroInfo {
  id: string;
  name: string;
  filename: string;
}

// Bundle correlation fields (see CONTEXT.md): embedded in each
// otherwise-ordinary wire payload; no bundle entity exists anywhere.
export interface BundleInfo {
  bundle_id: string;
  bundle_size: number;
  device_index: number;
}

interface PrepareMeasurementArgs {
  rawMeasurement: any;
  userId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
  bundle?: BundleInfo;
  fallbackDeviceId?: string;
}

export function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macro,
  timestamp,
  timezone,
  questions,
  commentText,
  bundle,
  fallbackDeviceId,
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
    // The firmware-provided device_id wins; the local USB/BT id is a weak
    // fallback (Android USB deviceIds are transient across replugs).
    ...(rawMeasurement.device_id == null && fallbackDeviceId
      ? { device_id: fallbackDeviceId }
      : {}),
    ...(bundle ?? {}),
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

interface SharedUploadArgs {
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
}

export function useMeasurementUpload() {
  const { saveMeasurement } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    // Save runs locally; the Outbox handles offline/online itself, so
    // there's no reason to pause the mutation off-network.
    networkMode: "always",
    mutationFn: async ({
      results,
      bundle,
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
    }: SharedUploadArgs & {
      results: { rawMeasurement: any; device?: Device }[];
      bundle: boolean;
    }) => {
      // Reject malformed input instead of resolving as a no-op. `typeof
      // null === "object"` would otherwise slip a null through to
      // prepareMeasurementForUpload() and crash on `"sample" in null`, and a
      // silent success would let the flow advance with nothing saved.
      for (const { rawMeasurement } of results) {
        if (rawMeasurement === null || typeof rawMeasurement !== "object") {
          throw new Error(
            `Invalid rawMeasurement: expected object, got ${rawMeasurement === null ? "null" : typeof rawMeasurement}`,
          );
        }
      }
      if (results.length === 0) {
        throw new Error("No measurements to upload");
      }

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });
      // One bundle_id per multi-scan round; each row is still its own MQTT
      // message in the ordinary envelope (see CONTEXT.md: Bundle).
      const bundleId = bundle && results.length > 1 ? uuidv4() : undefined;

      const savedIds: string[] = [];
      let lastStorageError: unknown;

      for (let index = 0; index < results.length; index++) {
        const { rawMeasurement, device } = results[index];
        const measurementData = prepareMeasurementForUpload({
          rawMeasurement,
          userId,
          macro,
          timestamp,
          timezone,
          questions,
          commentText,
          bundle: bundleId
            ? { bundle_id: bundleId, bundle_size: results.length, device_index: index }
            : undefined,
          fallbackDeviceId: device?.id,
        });

        const measurement = {
          topic,
          measurementResult: measurementData,
          metadata: { experimentName, protocolName, timestamp: measurementData.timestamp },
        };

        try {
          savedIds.push(await saveMeasurement(measurement, "pending"));
        } catch (storageError) {
          log.error("Failed to save measurement to local storage", {
            err: (storageError as Error)?.message,
          });
          lastStorageError = storageError;
          promptMeasurementFileSave(t, measurement);
          // Keep saving the remaining devices' measurements — one bad row
          // shouldn't discard the rest of the round.
        }
      }

      getOutbox().enqueueMany(savedIds);

      // Rethrow when nothing persisted so callers awaiting the upload can
      // distinguish a failed local save from success and avoid advancing the
      // flow with nothing saved.
      if (savedIds.length === 0) {
        throw lastStorageError instanceof Error
          ? lastStorageError
          : new Error("Failed to save measurements");
      }
    },
  });

  return {
    isUploading: mutation.isPending,
    uploadMeasurements: mutation.mutateAsync,
    uploadMeasurement: (args: SharedUploadArgs & { rawMeasurement: any }) => {
      const { rawMeasurement, ...shared } = args;
      return mutation.mutateAsync({
        ...shared,
        results: [{ rawMeasurement }],
        bundle: false,
      });
    },
  };
}
