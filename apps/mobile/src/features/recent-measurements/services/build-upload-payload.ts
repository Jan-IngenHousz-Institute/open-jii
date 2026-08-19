import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
import { MeasurementLocation } from "~/shared/location/measurement-location";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";

export interface MacroInfo {
  id: string;
  name: string;
  filename: string;
}

export interface BuildUploadPayloadArgs {
  rawMeasurement: any;
  userId: string;
  /** Real protocol uuid, or the "questions" sentinel for question-only rows. */
  protocolId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
  /** Stable UUID for the complete workbook attempt (see CONTEXT.md: Workbook run). */
  workbookRunId: string;
  /** Immutable workbook version that owns the macro snapshot. */
  workbookVersionId?: string;
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
  protocolId,
  macro,
  timestamp,
  timezone,
  questions,
  commentText,
  workbookRunId,
  workbookVersionId,
  macroContext,
  fallbackDeviceId,
  location,
}: BuildUploadPayloadArgs) {
  const macroFilenames = macro?.filename ? [macro.filename] : [];

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
    // After the spread: device-native output can carry its own protocol_id
    // (device-defined, not a platform id) and must not clobber the platform
    // attribution, including the "questions" sentinel.
    protocol_id: protocolId,
    ...(hasInjectableSample ? { sample: injectedSample } : {}),
    annotations: buildAnnotations(commentText),
    // The firmware-provided device_id wins; the local USB/BT id is a weak
    // fallback (Android USB deviceIds are transient across replugs).
    ...(rawMeasurement.device_id == null && fallbackDeviceId
      ? { device_id: fallbackDeviceId }
      : {}),
    workbook_run_id: workbookRunId,
    ...(workbookVersionId ? { workbook_version_id: workbookVersionId } : {}),
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
