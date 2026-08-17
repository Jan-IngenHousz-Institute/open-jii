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
  | "unknown-experiment";

export interface MacroPreviewSource {
  experimentId: string;
  workbookVersionId: string;
  macroId: string;
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
  const payload = measurement.data.measurementResult as Record<string, unknown>;

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

  return {
    ok: true,
    source: {
      experimentId,
      workbookVersionId,
      macroId,
      rawMeasurement: decodeStoredSample(payload),
      ctx: parseMacroContext(payload.macro_context),
    },
  };
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
