// Macro result shape, shared by the code that runs macros (features) and the UI
// that renders their output (shared/ui), so neither has to import the other.

export interface MacroMessageGroup {
  info?: string[];
  warning?: string[];
  danger?: string[];
}

export type MacroOutput = { messages?: MacroMessageGroup } & Record<string, any>;

export function isMacroOutput(value: unknown): value is MacroOutput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
