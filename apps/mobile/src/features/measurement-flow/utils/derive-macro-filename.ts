import { SHA256, enc } from "crypto-js";

// Mirrors backend generateHashedFilename (macros/core/models/macro.model.ts):
// filename = sha256(id) hex, so the app derives it offline without a fetch.
export function deriveMacroFilename(macroId: string): string {
  return `macro_${SHA256(macroId).toString(enc.Hex).substring(0, 12)}`;
}
