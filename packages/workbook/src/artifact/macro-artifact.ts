import { z } from "zod";

import { SENSOR_FAMILIES } from "@repo/iot";

// A macro may return a tagged artifact instead of a plain data record: a request
// to run a device command or protocol the macro constructed. The tag is NOT a
// trust signal (a macro can forge it); it only routes the value to the @repo/iot
// validator, which is the actual security boundary before any dispatch.

export const zArtifactFamily = z.enum(SENSOR_FAMILIES);
export type ArtifactFamily = z.infer<typeof zArtifactFamily>;

// A raw console command string (e.g. "battery", "light5"). Structured protocols
// use the protocol artifact instead, so no JSON/YAML parsing happens here.
export const zCommandArtifact = z
  .object({
    __ojArtifact: z.literal("command"),
    version: z.literal(1),
    content: z.string().min(1, "Command content is required"),
    name: z.string().optional(),
    family: zArtifactFamily.optional(),
  })
  .strict();

// A device protocol as a JSON array of instruction blocks, built in macro code.
export const zProtocolArtifact = z
  .object({
    __ojArtifact: z.literal("protocol"),
    version: z.literal(1),
    code: z.array(z.record(z.unknown())).min(1, "Protocol code must have at least one block"),
    name: z.string().optional(),
    family: zArtifactFamily.optional(),
  })
  .strict();

export const zMacroArtifact = z.discriminatedUnion("__ojArtifact", [
  zCommandArtifact,
  zProtocolArtifact,
]);

export type CommandArtifact = z.infer<typeof zCommandArtifact>;
export type ProtocolArtifact = z.infer<typeof zProtocolArtifact>;
export type MacroArtifact = z.infer<typeof zMacroArtifact>;

// Detects whether a macro's opaque output is a constructed artifact. Returns null
// for plain data records, so existing macros are treated as data exactly as before.
export function parseMacroArtifact(output: unknown): MacroArtifact | null {
  if (output == null || typeof output !== "object" || !("__ojArtifact" in output)) {
    return null;
  }
  const parsed = zMacroArtifact.safeParse(output);
  return parsed.success ? parsed.data : null;
}
