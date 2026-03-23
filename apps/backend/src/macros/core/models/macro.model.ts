import { createHash } from "crypto";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { macros } from "@repo/database";

/**
 * Generate a hashed filename based on the macro ID and version.
 * Each version gets a unique filename for Databricks isolation.
 */
export function generateHashedFilename(macroId: string, version: number = 1): string {
  const hash = createHash("sha256").update(macroId).digest("hex");
  return `macro_${hash.substring(0, 12)}_v${version}`;
}

export const createMacroSchema = createInsertSchema(macros).omit({
  filename: true, // filename is derived from id + version
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateMacroSchema = createInsertSchema(macros).partial().omit({
  id: true,
  filename: true, // filename is derived from name
  version: true, // version is computed server-side
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
