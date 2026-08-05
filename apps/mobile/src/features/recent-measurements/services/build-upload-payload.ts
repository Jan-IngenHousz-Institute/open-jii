import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
import { MeasurementLocation } from "~/shared/location/measurement-location";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";
import { resolveMeasurementDeviceId } from "~/shared/measurements/measurement-device-id";

export interface MacroInfo {
  id: string;
  name: string;
  filename: string;
}

export interface BuildUploadPayloadArgs {
  rawMeasurement: any;
  userId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
  /** One uuid per multi-device round (see CONTEXT.md: Workbook run). */
  workbookRunId?: string;
  /** Immutable workbook version that owns the macro snapshot. */
  workbookVersionId?: string;
  /** Stable id minted when execution enters this workbook attempt. */
  workbookAttemptId?: string;
  /** Workbook producer cell for this measurement row. */
  producerCellId?: string;
  /** Parallel container that owns this row, when execution is lane-scoped. */
  containerCellId?: string;
  /** Stable lane id within the owning parallel container. */
  laneId?: string;
  /** Container-entry attempt, distinct from the enclosing workbook attempt. */
  containerAttemptId?: string;
  /** Device-scoped upstream workbook values consumed by the macro as `ctx`. */
  macroContext?: Record<string, unknown>;
  fallbackDeviceId?: string;
  /** GPS fix at measurement time; null/absent uploads without location. */
  location?: MeasurementLocation | null;
}

// Pure: never mutates rawMeasurement or its sample entries. Macro filenames
// are injected into cloned sample entries before compression.
export function buildUploadPayload({
  rawMeasurement,
  userId,
  macro,
  timestamp,
  timezone,
  questions,
  commentText,
  workbookRunId,
  workbookVersionId,
  workbookAttemptId,
  producerCellId,
  containerCellId,
  laneId,
  containerAttemptId,
  macroContext,
  fallbackDeviceId,
  location,
}: BuildUploadPayloadArgs) {
  const macroFilenames = macro?.filename ? [macro.filename] : [];
  const measurementDeviceId = resolveMeasurementDeviceId(rawMeasurement, fallbackDeviceId);
  const containerProvenanceParts = [containerCellId, laneId, containerAttemptId];
  const hasContainerProvenance = containerProvenanceParts.every(Boolean);
  if (!hasContainerProvenance && containerProvenanceParts.some(Boolean)) {
    throw new Error(
      "Parallel measurement provenance requires containerCellId, laneId, and containerAttemptId",
    );
  }

  let injectedSample: unknown;
  const hasInjectableSample = "sample" in rawMeasurement && rawMeasurement.sample;
  if (hasInjectableSample) {
    const raw = rawMeasurement.sample;
    injectedSample = Array.isArray(raw)
      ? raw.map((entry: object) => ({ ...entry, macros: macroFilenames }))
      : { ...raw, macros: macroFilenames };
  }

  const payload = {
    questions,
    macros: macro ? [macro] : [],
    timestamp,
    timezone,
    user_id: userId,
    ...rawMeasurement,
    ...(hasInjectableSample ? { sample: injectedSample } : {}),
    annotations: buildAnnotations(commentText),
    // The firmware-provided device_id wins; the local USB/BT id is a weak
    // fallback (Android USB deviceIds are transient across replugs).
    ...(measurementDeviceId !== undefined ? { device_id: measurementDeviceId } : {}),
    ...(workbookRunId ? { workbook_run_id: workbookRunId } : {}),
    ...(workbookVersionId ? { workbook_version_id: workbookVersionId } : {}),
    ...(workbookAttemptId ? { workbook_attempt_id: workbookAttemptId } : {}),
    ...(producerCellId ? { producer_cell_id: producerCellId } : {}),
    ...(hasContainerProvenance
      ? {
          container_cell_id: containerCellId,
          lane_id: laneId,
          container_attempt_id: containerAttemptId,
        }
      : {}),
    ...(macroContext ? { macro_context: JSON.stringify(macroContext) } : {}),
    ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
  };

  // Compress the (large) sample field to reduce MQTT payload size.
  // The outer JSON envelope stays valid for AWS IoT Core SQL parsing.
  if (payload.sample != null) {
    payload.sample = compressSample(payload.sample);
    payload._sample_encoding = "gzip+base64";
  }

  return payload;
}
