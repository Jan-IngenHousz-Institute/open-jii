import type { MacroOutput } from "./process-scan";

export type RunPythonMacroFn = (code: string, json: object) => Promise<MacroOutput>;

let runner: RunPythonMacroFn | null = null;

export function registerPythonMacroRunner(fn: RunPythonMacroFn | null): void {
  runner = fn;
}

export function getPythonMacroRunner(): RunPythonMacroFn | null {
  return runner;
}
