import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { commands } from "@repo/database";

export const createCommandSchema = createInsertSchema(commands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateCommandSchema = createInsertSchema(commands).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const selectCommandSchema = createSelectSchema(commands).extend({
  createdByName: z.string().optional(),
});

export type CreateCommandDto = z.infer<typeof createCommandSchema>;
export type UpdateCommandDto = z.infer<typeof updateCommandSchema>;
export type CommandDto = z.infer<typeof selectCommandSchema>;
