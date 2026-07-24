import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { createLogger } from "~/shared/observability/logger";

import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

import mathLibResource from "./math.lib.js.txt";
import { getPythonMacroRunner } from "./python-macro-runner";

const log = createLogger("macro");

interface MacroOutputMessages {
  messages?: {
    info?: string[];
    warning?: string[];
    danger?: string[];
  };
}

export type MacroOutput = MacroOutputMessages & Record<string, any>;

async function loadMathLib() {
  const asset = Asset.fromModule(mathLibResource);
  await asset.downloadAsync();
  const path = asset.localUri ?? asset.uri;
  const file = new File(path);
  return await file.text();
}

const mathLibSourcePromise = loadMathLib();

// Deep-freeze so macro code reads `ctx` as read-only, matching the Lambda sandbox.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

async function executeMacro(code: string, json: unknown, ctx: object): Promise<MacroOutput> {
  const mathLibSource = await mathLibSourcePromise;
  // Wrap the macro in an IIFE that receives `json` (nearest input) and `ctx`
  // (upstream outputs by name), isolating its scope from mathLib internals.
  const macroSource =
    mathLibSource + "\n\n\n" + "return (function(json, ctx) {\n" + code + "\n})(json, ctx);";

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function("json", "ctx", macroSource);
    const output = fn(structuredClone(json), deepFreeze(structuredClone(ctx)));
    return output;
  } catch (err) {
    log.error("(JS) error", { err: (err as Error)?.message });
    throw err;
  }
}

export interface MacroInput {
  code: string;
  language?: string;
}

export class MacroInputNormalizationError extends Error {
  constructor(
    public readonly code: "empty-envelope",
    public readonly source: "sample-envelope",
  ) {
    super(`Macro input rejected: ${code}`);
    this.name = "MacroInputNormalizationError";
  }
}

export async function applyMacro(
  result: unknown,
  macro: MacroInput | string,
  ctx: Record<string, unknown> = {},
): Promise<MacroOutput[]> {
  const normalized = normalizeMacroInput(result);
  if (!normalized.ok) {
    log.error("input normalization failed", {
      error: normalized.error,
      source: normalized.source,
      sourceCount: normalized.sourceCount,
    });
    throw new MacroInputNormalizationError(normalized.error, normalized.source);
  }

  if (normalized.warning) {
    log.warn("input normalization warning", {
      warning: normalized.warning,
      source: normalized.source,
      sourceCount: normalized.sourceCount,
      discardedCount: normalized.discardedCount,
    });
  }

  const macroInput: MacroInput =
    typeof macro === "string" ? { code: macro, language: "javascript" } : macro;
  const code = atob(macroInput.code);
  const language = (macroInput.language ?? "javascript").toLowerCase();

  log.debug("apply", { language, source: normalized.source, code_bytes: code.length });

  if (language === "python") {
    const runPython = getPythonMacroRunner();
    if (!runPython) {
      throw new Error("Python macro runner not ready. Ensure PythonMacroProvider is mounted.");
    }
    try {
      const out = await runPython(code, structuredClone(normalized.value), ctx);
      log.debug("(Python) measurement ok");
      return [out];
    } catch (err) {
      log.error("(Python) measurement failed", { err: (err as Error)?.message });
      throw err;
    }
  }

  try {
    const out = await executeMacro(code, normalized.value, ctx);
    return [out];
  } catch (err) {
    log.error("(JS) measurement failed", { err: (err as Error)?.message });
    throw err;
  }
}
