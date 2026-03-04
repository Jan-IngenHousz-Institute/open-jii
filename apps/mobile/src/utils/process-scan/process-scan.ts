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
    const output = fn(json);
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

export async function applyMacro(
  result: object,
  macro: MacroInput | string,
): Promise<MacroOutput[]> {
  if (!("sample" in result)) {
    throw new Error("Result does not contain sample data");
  }

  const { sample } = result;

  if (!sample) {
    throw new Error("Sample data is missing");
  }

  const samples = Array.isArray(sample) ? sample : [sample];

  const macroInput: MacroInput =
    typeof macro === "string" ? { code: macro, language: "javascript" } : macro;
  const code = atob(macroInput.code);
  const language = (macroInput.language ?? "javascript").toLowerCase();

  const codePreview = code.length > 500 ? code.slice(0, 500) + "..." : code;
  console.log("[macro] code preview:", codePreview);
  console.log("[macro] language:", language, "samples:", samples.length);

  if (language === "python") {
    const runPython = getPythonMacroRunner();
    if (!runPython) {
      throw new Error("Python macro runner not ready. Ensure PythonMacroProvider is mounted.");
    }
    const outputs: MacroOutput[] = [];
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      console.log("[macro] (Python) input sample", i, JSON.stringify(sample));
      try {
        const out = await runPython(code, sample);
        console.log("[macro] (Python) output sample", i, JSON.stringify(out));
        outputs.push(out);
      } catch (err) {
        console.error("[macro] (Python) error sample", i, err);
        throw err;
      }
    }
    return outputs;
  }

  const outputs: MacroOutput[] = [];
  for (let i = 0; i < samples.length; i++) {
    try {
      const out = await executeMacro(code, samples[i]);
      outputs.push(out);
    } catch (err) {
      console.error("[macro] (JS) error sample", i, err);
      throw err;
    }
  }
  return outputs;
}
