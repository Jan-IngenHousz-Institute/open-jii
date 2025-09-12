import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { macros } from "@repo/database";

export const createMacroSchema = createInsertSchema(macros).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateMacroSchema = createInsertSchema(macros).partial().omit({
  id: true,
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
