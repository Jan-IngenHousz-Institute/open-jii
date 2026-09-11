import { compressSample } from "~/features/recent-measurements/utils/compress-sample";
import { MeasurementLocation } from "~/shared/location/measurement-location";
import type { ClientMetadata } from "~/shared/measurements/client-metadata";
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
  /** Real protocol uuid. */
  protocolId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
  /** Stable UUID for the complete workbook attempt (see CONTEXT.md: Workbook run). */
  workbookRunId: string;
  /** Immutable workbook version that owns the macro snapshot. */
  workbookVersionId: string;
  /** The workbook that version belongs to, so a stored measurement's macro can
   * be re-run against the producing workbook even after the experiment is
   * detached or re-attached elsewhere. */
  workbookId?: string;
  /** Device-scoped upstream workbook values consumed by the macro as `ctx`. */
  macroContext?: Record<string, unknown>;
  fallbackDeviceId?: string;
  /** Canonical sensor family captured by the connection handshake. */
  fallbackDeviceFamily?: string;
  /** Sensor hardware address seen by this phone (Bluetooth MAC), when stable. */
  fallbackDeviceAddress?: string;
  /** Physical sensor firmware captured by the connection handshake. */
  fallbackDeviceFirmware?: string;
  /** GPS fix at measurement time; null/absent uploads without location. */
  location?: MeasurementLocation | null;
  /** Publishing phone and OS; distinct from the sensor's `device_*` fields. */
  client?: ClientMetadata;
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
  workbookId,
  macroContext,
  fallbackDeviceId,
  fallbackDeviceFamily,
  fallbackDeviceAddress,
  fallbackDeviceFirmware,
  location,
  client,
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
    // attribution.
    protocol_id: protocolId,
    ...(hasInjectableSample ? { sample: injectedSample } : {}),
    annotations: buildAnnotations(commentText),
    // The firmware-provided device_id wins; the local USB/BT id is a weak
    // fallback (Android USB deviceIds are transient across replugs).
    ...(rawMeasurement.device_id == null && fallbackDeviceId
      ? { device_id: fallbackDeviceId }
      : {}),
    // Report the canonical driver family so downstream consumers can
    // distinguish MultispeQ, Ambit, MiniPAR, and generic devices without
    // interpreting a device-reported display name.
    ...(rawMeasurement.device_family == null && fallbackDeviceFamily
      ? { device_family: fallbackDeviceFamily }
      : {}),
    // The sensor's full hardware address as this phone reached it. Reported
    // alongside device_id, never instead of it: MultispeQ firmware answers
    // device_info with a truncated id (4 of 6 octets), so the complete value
    // only exists at the transport.
    ...(rawMeasurement.device_address == null && fallbackDeviceAddress
      ? { device_address: fallbackDeviceAddress }
      : {}),
    // Preserve an explicit device-native value; otherwise report the version
    // learned by the mobile connection handshake for this physical sensor.
    ...(rawMeasurement.device_firmware == null && fallbackDeviceFirmware
      ? { device_firmware: fallbackDeviceFirmware }
      : {}),
    workbook_run_id: workbookRunId,
    workbook_version_id: workbookVersionId,
    ...(workbookId ? { workbook_id: workbookId } : {}),
    ...(macroContext ? { macro_context: JSON.stringify(macroContext) } : {}),
    ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
    // Phone provenance. Spread last but never overwrites device-native keys:
    // every key is `client_`-prefixed, disjoint from the sensor's `device_*`.
    ...client,
  };

  // Compress the (large) sample field to reduce MQTT payload size.
  // The outer JSON envelope stays valid for AWS IoT Core SQL parsing.
  if (payload.sample != null) {
    payload.sample = compressSample(payload.sample);
    payload._sample_encoding = "gzip+base64";
  }

  return payload;
}
