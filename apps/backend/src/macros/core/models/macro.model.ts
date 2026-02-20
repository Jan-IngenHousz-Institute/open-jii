import { createHash } from "crypto";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { macros } from "@repo/database";

/**
 * Generate a hashed filename based on the macro ID
 */
export function generateHashedFilename(macroId: string): string {
  const hash = createHash("sha256").update(macroId).digest("hex");
  // Use first 12 characters for a reasonable length filename
  return `macro_${hash.substring(0, 12)}`;
}

export const createMacroSchema = createInsertSchema(macros).omit({
  id: true,
  filename: true, // filename is derived from name
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateMacroSchema = createInsertSchema(macros).partial().omit({
  id: true,
  filename: true, // filename is derived from name
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const selectMacroSchema = createSelectSchema(macros).extend({
  createdByName: z.string().optional(),
});

export type CreateMacroDto = z.infer<typeof createMacroSchema>;
export type UpdateMacroDto = z.infer<typeof updateMacroSchema>;
export type MacroDto = z.infer<typeof selectMacroSchema>;

/** Lean projection for Lambda execution — only the columns needed to run a script. */
export type MacroScript = Pick<MacroDto, "id" | "name" | "language" | "code">;
