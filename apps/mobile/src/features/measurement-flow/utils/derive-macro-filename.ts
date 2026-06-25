import { SHA256, enc } from "crypto-js";

// Mirrors the backend's generateHashedFilename (apps/backend/src/macros/core/
// models/macro.model.ts): a macro's storage filename is a pure sha256 hash of
// its id, so the app derives it offline from the workbook cell instead of
// fetching the macro row just to read a value it can compute.
export function deriveMacroFilename(macroId: string): string {
  return `macro_${SHA256(macroId).toString(enc.Hex).substring(0, 12)}`;
}
