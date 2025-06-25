import { z } from "zod";

// Define Zod schemas for protocol models
export const zProtocol = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  code: z.record(z.unknown()).array(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zProtocolList = z.array(zProtocol);

// Query parameters
export const zProtocolFilterQuery = z.object({
  search: z.string().optional(),
});

// Path parameters
export const zProtocolIdPathParam = z.object({
  id: z.string().uuid(),
});

// Request body schemas
export const zCreateProtocolRequest = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  code: z.record(z.unknown()).array(),
});

export const zUpdateProtocolRequest = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  code: z.record(z.unknown()).array().optional(),
});

// Error response
export const zProtocolErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

// Infer types from Zod schemas
export type Protocol = z.infer<typeof zProtocol>;
export type ProtocolList = z.infer<typeof zProtocolList>;
export type ProtocolFilterQuery = z.infer<typeof zProtocolFilterQuery>;
export type ProtocolFilter = ProtocolFilterQuery["search"];
export type ProtocolIdPathParam = z.infer<typeof zProtocolIdPathParam>;
export type CreateProtocolRequest = z.infer<typeof zCreateProtocolRequest>;
export type UpdateProtocolRequest = z.infer<typeof zUpdateProtocolRequest>;
export type ProtocolErrorResponse = z.infer<typeof zProtocolErrorResponse>;
