import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";
import { protocols } from "@repo/database";

export const createProtocolSchema = createInsertSchema(protocols).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  searchVector: true,
});

export const updateProtocolSchema = createInsertSchema(protocols).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  searchVector: true,
});

export const selectProtocolSchema = createSelectSchema(protocols)
  .omit({ searchVector: true })
  .extend({
    createdByName: z.string().optional(),
    // The DB column is the shared sensor_family enum, but no protocol row can
    // be mobile (the contract rejects it on every write path), so the DTO
    // carries the same narrowed family the contract promises.
    family: zProtocolFamily,
  });

export type CreateProtocolDto = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolDto = z.infer<typeof updateProtocolSchema>;
export type ProtocolDto = z.infer<typeof selectProtocolSchema>;
