import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
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
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
  /** One uuid per multi-device round (see CONTEXT.md: Workbook run). */
  workbookRunId?: string;
  /** Immutable workbook version that owns the macro snapshot. */
  workbookVersionId?: string;
  /** Device-scoped upstream workbook values consumed by the macro as `ctx`. */
  macroContext?: Record<string, unknown>;
  fallbackDeviceId?: string;
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
  macroContext,
  fallbackDeviceId,
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
    ...(hasInjectableSample ? { sample: injectedSample } : {}),
    annotations: buildAnnotations(commentText),
    // The firmware-provided device_id wins; the local USB/BT id is a weak
    // fallback (Android USB deviceIds are transient across replugs).
    ...(rawMeasurement.device_id == null && fallbackDeviceId
      ? { device_id: fallbackDeviceId }
      : {}),
    ...(workbookRunId ? { workbook_run_id: workbookRunId } : {}),
    ...(workbookVersionId ? { workbook_version_id: workbookVersionId } : {}),
    ...(macroContext ? { macro_context: JSON.stringify(macroContext) } : {}),
  };

  // Compress the (large) sample field to reduce MQTT payload size.
  // The outer JSON envelope stays valid for AWS IoT Core SQL parsing.
  if (payload.sample != null) {
    payload.sample = compressSample(payload.sample);
    payload._sample_encoding = "gzip+base64";
  }

  return payload;
}
