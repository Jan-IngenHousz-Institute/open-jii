import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";

export interface MacroInfo {
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

export interface BuildUploadPayloadArgs {
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
  bundle,
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
