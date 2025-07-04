import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { protocols } from "@repo/database";

export const createProtocolSchema = createInsertSchema(protocols).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateProtocolSchema = createInsertSchema(protocols).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const selectProtocolSchema = createSelectSchema(protocols);

export type CreateProtocolDto = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolDto = z.infer<typeof updateProtocolSchema>;
export type ProtocolDto = z.infer<typeof selectProtocolSchema>;
