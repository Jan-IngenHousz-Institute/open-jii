import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import mathLibResource from "./math.lib.js.txt";

async function loadMathLib() {
  const asset = Asset.fromModule(mathLibResource);
  await asset.downloadAsync();
  const path = asset.localUri ?? asset.uri;
  const file = new File(path);
  return await file.text();
}

const mathLibSourcePromise = loadMathLib();

async function executeMacro(code: string, json: object) {
  const mathLibSource = await mathLibSourcePromise;
  // Wrap the macro code in an IIFE to isolate its scope from mathLibSource variables
  // This prevents variable name conflicts while still allowing access to mathLib functions
  // The IIFE returns the output, which we capture and return
  const macroSource =
    mathLibSource + "\n\n\n" + "return (function(json) {\n" + code + "\n})(json);";

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("json", macroSource);
  return fn(json);
}

export async function applyMacro(result: object, macroCodeBase64: string): Promise<object[]> {
  if (!("sample" in result)) {
    throw new Error("Result does not contain sample data");
  }

  const { sample } = result;

  if (!sample) {
    throw new Error("Sample data is missing");
  }

  const samples = Array.isArray(sample) ? sample : [sample];

  const code = atob(macroCodeBase64);
  console.log("executing macro");
  const output: object[] = await Promise.all(samples.map((sample) => executeMacro(code, sample)));

  return output;
}
