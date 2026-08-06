import { OutputDataNormalizationError } from "@repo/api/transforms/build-cell-namespace";
import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

/** The shared main-host projection for device-producer and dispatch outputs. */
export function normalizeOutputData(raw: unknown): unknown {
  const normalized = normalizeMacroInput(raw);
  if (!normalized.ok) {
    throw new OutputDataNormalizationError(normalized.error, normalized.source);
  }
  return normalized.value;
}
