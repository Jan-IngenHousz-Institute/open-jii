import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { macros } from "@repo/database";

/**
 * Derive filename from name by converting to lowercase, trimming, and replacing spaces with underscores
 */
export function deriveFilenameFromName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_");
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
