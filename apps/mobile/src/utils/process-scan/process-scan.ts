import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import mathLibResource from "./math.lib.js.txt";
import { getPythonMacroRunner } from "./python-macro-runner";

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

async function executeMacro(code: string, json: object): Promise<MacroOutput> {
  // console.log("[macro] (JS) input:", JSON.stringify(json));
  const mathLibSource = await mathLibSourcePromise;
  // Wrap the macro code in an IIFE to isolate its scope from mathLibSource variables
  // This prevents variable name conflicts while still allowing access to mathLib functions
  // The IIFE returns the output, which we capture and return
  const macroSource =
    mathLibSource + "\n\n\n" + "return (function(json) {\n" + code + "\n})(json);";

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function("json", macroSource);
    const output = fn(structuredClone(json));
    // console.log("[macro] (JS) output:", JSON.stringify(output));
    return output;
  } catch (err) {
    console.error("[macro] (JS) error:", err);
    throw err;
  }
}

export interface MacroInput {
  code: string;
  language?: string;
}

// Macros receive the full measurement wrapper and loop over json["sample"]
// themselves, matching the Databricks and macro-sandbox executors.
export async function applyMacro(result: object, macro: MacroInput | string): Promise<MacroOutput> {
  if (!("sample" in result)) {
    throw new Error("Result does not contain sample data");
  }

  const macroInput: MacroInput =
    typeof macro === "string" ? { code: macro, language: "javascript" } : macro;
  const code = atob(macroInput.code);
  const language = (macroInput.language ?? "javascript").toLowerCase();

  const codePreview = code.length > 500 ? code.slice(0, 500) + "..." : code;
  console.log("[macro] code preview:", codePreview);
  console.log("[macro] language:", language);

  if (language === "python") {
    const runPython = getPythonMacroRunner();
    if (!runPython) {
      throw new Error("Python macro runner not ready. Ensure PythonMacroProvider is mounted.");
    }
    try {
      return await runPython(code, structuredClone(result));
    } catch (err) {
      console.error("[macro] (Python) error:", err);
      throw err;
    }
  }

  if (language !== "javascript") {
    throw new Error(`Unsupported macro language: ${language}`);
  }

  return executeMacro(code, structuredClone(result));
}
