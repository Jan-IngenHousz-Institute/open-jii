import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { applyMacro } from "~/features/measurement-flow/utils/process-scan/process-scan";
import type { MacroInput } from "~/features/measurement-flow/utils/process-scan/process-scan";
import type { MacroOutput } from "~/shared/measurements/macro-output";

interface UseMacroOutputsArgs {
  /** Measurement handed to the macro as `json` (after input normalization). */
  rawMeasurement: unknown;
  macro: MacroInput | undefined;
  /** Upstream cell outputs the macro reads as `ctx.<name>`. */
  ctx?: Record<string, unknown>;
  /**
   * Stable identity for the cache key (e.g. `<measurementId>/<workbookVersionId>/<macroId>`).
   * When set, the payload object stays out of the key, so a large measurement
   * is neither re-hashed on every render nor pinned in the cache by identity.
   * Callers without a stable id (the live flow) omit it and key on the payload.
   */
  cacheKey?: string;
  /** Prevents execution when an upstream output could not be normalized. */
  inputError?: Error;
  /** Defer the run, e.g. until a sheet is actually opened. */
  enabled?: boolean;
  /** Called with the outputs once computed, so a flow can persist them. */
  onProcessed?: (outputs: MacroOutput[]) => void;
}

// The app-wide default gcTime is Infinity (for the persisted offline cache);
// macro outputs are cheap to recompute and hold the decoded payload (~150 KB),
// so they are garbage-collected once unused instead of pinned forever.
const MACRO_OUTPUTS_GC_TIME = 5 * 60 * 1000;

/**
 * Runs a macro over a measurement and caches the result. Shared by the live
 * flow and by re-running a stored measurement, so both paths execute macros
 * exactly the same way.
 */
export function useMacroOutputs({
  rawMeasurement,
  macro,
  ctx,
  cacheKey,
  inputError,
  enabled = true,
  onProcessed,
}: UseMacroOutputsArgs) {
  const {
    data: outputs,
    isLoading,
    error,
  } = useQuery({
    // applyMacro is a pure local computation; "always" keeps it from being
    // paused by the onlineManager while offline.
    networkMode: "always",
    gcTime: MACRO_OUTPUTS_GC_TIME,
    enabled: enabled && !!macro && rawMeasurement !== undefined,
    // ctx enters the key as a stable serialization so a changed upstream
    // output recomputes, while an identical rebuild does not. With a cacheKey
    // the (large) payload object stays out of the key entirely.
    queryKey: [
      "measurement-result",
      cacheKey ?? rawMeasurement,
      macro,
      ctx ? JSON.stringify(ctx) : undefined,
      inputError?.name,
      inputError?.message,
    ],
    queryFn: () => {
      if (inputError) throw inputError;
      // Unreachable while `enabled` gates on macro; keeps the cast out.
      if (!macro) throw new Error("Macro code not resolved");
      return applyMacro(rawMeasurement, macro, ctx ?? {});
    },
  });

  // Surface the computed outputs so a flow can persist them (cellOutputs) for
  // downstream branches/macros. No-op outside a flow (onProcessed unset).
  useEffect(() => {
    if (outputs && onProcessed) onProcessed(outputs);
  }, [outputs, onProcessed]);

  return { outputs, isLoading, error };
}
