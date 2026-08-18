import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zJsonValue } from "@repo/api/domains/protocol/protocol.schema";
import { protocols } from "@repo/database";

/**
 * drizzle-zod widens a jsonb column to `Json`, which the contract's
 * `JsonValue` is not assignable to. A protocol's code shape is device-defined
 * (MultispeQ protocols are always arrays of objects, other families their
 * own), so it is typed as any valid JSON document here, letting the
 * controller hand the value straight to the column instead of
 * pre-serializing it. See OJD-1711.
 */
const protocolCodeSchema = zJsonValue;

export const createProtocolSchema = createInsertSchema(protocols, {
  code: protocolCodeSchema,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  searchVector: true,
});

export const updateProtocolSchema = createInsertSchema(protocols, {
  code: protocolCodeSchema,
})
  .partial()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    searchVector: true,
  });

export const selectProtocolSchema = createSelectSchema(protocols, {
  code: protocolCodeSchema,
})
  .omit({ searchVector: true })
  .extend({
    createdByName: z.string().optional(),
  });

export type CreateProtocolDto = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolDto = z.infer<typeof updateProtocolSchema>;
export type ProtocolDto = z.infer<typeof selectProtocolSchema>;
