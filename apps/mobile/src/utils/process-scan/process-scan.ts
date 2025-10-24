import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import mathLibResource from "./math.lib.js.txt";

async function loadMathLib() {
  const asset = Asset.fromModule(mathLibResource);
  await asset.downloadAsync();
  const path = asset.localUri ?? asset.uri;
  return await FileSystem.readAsStringAsync(path);
}

let mathLibSource = "";

loadMathLib().then((source) => {
  mathLibSource = source;
});

export function processScan(
  result: object,
  userId?: string,
  macroFilename?: string,
  macroCodeBase64?: string,
  onError?: (message: string) => void,
) {
  if (!("sample" in result)) {
    return result;
  }

  const { sample } = result;

  if (!sample) {
    return result;
  }

  const samples = Array.isArray(sample) ? sample : [sample];
  const timestamp = new Date().toISOString();

  let output: object[] | undefined = undefined;
  try {
    if (macroCodeBase64) {
      const code = atob(macroCodeBase64);
      console.log("executing macro", macroFilename);
      output = samples.map((sample) => executeMacro(code, sample));
    }
  } catch (e: any) {
    console.log("error executing local macro", e);
    onError?.(e.message);
    throw e;
  }

  for (const sample of samples) {
    sample.macros = [macroFilename];
  }

  return { ...result, timestamp, output, userId };
}

export function executeMacro(code: string, json: object) {
  const macroSource = mathLibSource + "\n\n\n" + code;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("json", macroSource);
  return fn(json);
}
