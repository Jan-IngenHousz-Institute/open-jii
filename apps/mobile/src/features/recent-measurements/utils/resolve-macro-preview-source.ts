import { decodeStoredSample } from "~/features/recent-measurements/utils/decode-stored-sample";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { parseMeasurementTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-preview");

/** Why a stored measurement can't be re-run through its macro. */
export type MacroPreviewBlocker =
  /** Questions-only save, or a measurement taken without a macro cell. */
  | "no-macro"
  /** Saved before workbook_version_id existed, so the macro snapshot is unknown. */
  | "no-workbook-version"
  /** Topic doesn't carry an experiment id, so the workbook can't be located. */
  | "unknown-experiment"
  /** The stored sample envelope couldn't be decompressed back to macro input. */
  | "decode-failed";

export interface MacroPreviewSource {
  experimentId: string;
  workbookVersionId: string;
  macroId: string;
  /**
   * The workbook that produced the measurement, recorded at capture time.
   * Present only on payloads saved after this field existed; legacy payloads
   * fall back to the experiment's current workbook linkage.
   */
  workbookId?: string;
  /** Payload with the sample envelope restored, as handed to the macro. */
  rawMeasurement: Record<string, unknown>;
  /** The exact device-scoped ctx recorded at capture time. */
  ctx: Record<string, unknown>;
}

/**
 * Everything needed to re-run a stored measurement's macro, read off the saved
 * payload alone: which macro ran, which immutable workbook version owns its
 * code, the measurement itself and the ctx the macro saw. Pure; the caller
 * fetches the workbook version and runs the macro.
 */
export function resolveMacroPreviewSource(
  measurement: StoredMeasurement,
): { ok: true; source: MacroPreviewSource } | { ok: false; blocker: MacroPreviewBlocker } {
  const payload = measurement.data.measurementResult;

  const macros = payload.macros;
  const macroId = Array.isArray(macros)
    ? (macros[0] as { id?: unknown } | undefined)?.id
    : undefined;
  if (typeof macroId !== "string" || macroId === "") return { ok: false, blocker: "no-macro" };

  const workbookVersionId = payload.workbook_version_id;
  if (typeof workbookVersionId !== "string" || workbookVersionId === "") {
    return { ok: false, blocker: "no-workbook-version" };
  }

  const { experimentId } = parseMeasurementTopic(measurement.data.topic);
  if (!experimentId) return { ok: false, blocker: "unknown-experiment" };

  const decoded = decodeStoredSample(payload);
  if (!decoded) return { ok: false, blocker: "decode-failed" };

  const workbookId = payload.workbook_id;

  return {
    ok: true,
    source: {
      experimentId,
      workbookVersionId,
      macroId,
      ...(typeof workbookId === "string" && workbookId !== "" ? { workbookId } : {}),
      rawMeasurement: stripUploadEnvelope(decoded),
      ctx: parseMacroContext(payload.macro_context),
    },
  };
}

// Keys buildUploadPayload wraps around the raw scan result. Stripped on replay
// so the macro re-sees the input it ran against at capture time: a macro that
// enumerates its input's keys would otherwise read the envelope as data.
// timestamp/timezone/user_id/device_id/location are deliberately left alone —
// they may have been part of the raw measurement itself, which is
// indistinguishable from the upload-time addition after the fact.
const UPLOAD_ENVELOPE_KEYS: ReadonlySet<string> = new Set([
  "questions",
  "macros",
  "annotations",
  "workbook_run_id",
  "workbook_version_id",
  "workbook_id",
  "macro_context",
]);

function stripUploadEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  const restored = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !UPLOAD_ENVELOPE_KEYS.has(key)),
  );
  // buildUploadPayload also injects `macros` (the filename routing list) into
  // every sample entry; the capture-time entries didn't carry it.
  if ("sample" in restored) {
    restored.sample = stripInjectedMacros(restored.sample);
  }
  return restored;
}

function stripInjectedMacros(sample: unknown): unknown {
  const stripEntry = (entry: unknown): unknown => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !("macros" in entry)) {
      return entry;
    }
    const { macros: _macros, ...rest } = entry as Record<string, unknown>;
    return rest;
  };
  if (Array.isArray(sample)) return sample.map(stripEntry);
  return stripEntry(sample);
}

// Stored as a JSON string by build-upload-payload. A malformed value falls back
// to an empty ctx: the macro still runs, it just reads no upstream outputs.
function parseMacroContext(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value === "") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    log.warn("macro_context parse failed", { err: (error as Error)?.message });
  }
  return {};
}
