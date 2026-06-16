import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { protocols, protocolVersions } from "@repo/database";

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

export const selectProtocolSchema = createSelectSchema(protocols).extend({
  createdByName: z.string().optional(),
});

export type CreateProtocolDto = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolDto = z.infer<typeof updateProtocolSchema>;
export type ProtocolDto = z.infer<typeof selectProtocolSchema>;

export const selectProtocolVersionSchema = createSelectSchema(protocolVersions).extend({
  createdByName: z.string().optional(),
});
export type ProtocolVersionDto = z.infer<typeof selectProtocolVersionSchema>;

/** Lightweight version-history entry (no code). */
export type ProtocolVersionSummaryDto = Pick<
  ProtocolVersionDto,
  "version" | "createdBy" | "createdByName" | "createdAt"
>;
