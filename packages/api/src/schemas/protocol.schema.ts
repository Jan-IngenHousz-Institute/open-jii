import { z } from "zod";

export const zSensorFamily = z.enum(["multispeq", "ambit"]);

// Define Zod schemas for protocol models
export const zProtocol = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  code: z.record(z.unknown()).array(),
  family: zSensorFamily,
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
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
export const zCreateProtocolRequestBody = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  code: z.record(z.unknown()).array(),
  family: zSensorFamily,
});

export const zUpdateProtocolRequestBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  code: z.record(z.unknown()).array().optional(),
  family: zSensorFamily.optional(),
});

// Error response
export const zProtocolErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

// Infer types from Zod schemas
export type SensorFamily = z.infer<typeof zSensorFamily>;
export type Protocol = z.infer<typeof zProtocol>;
export type ProtocolList = z.infer<typeof zProtocolList>;
export type ProtocolFilterQuery = z.infer<typeof zProtocolFilterQuery>;
export type ProtocolFilter = ProtocolFilterQuery["search"];
export type ProtocolIdPathParam = z.infer<typeof zProtocolIdPathParam>;
export type CreateProtocolRequestBody = z.infer<typeof zCreateProtocolRequestBody>;
export type UpdateProtocolRequestBody = z.infer<typeof zUpdateProtocolRequestBody>;
export type ProtocolErrorResponse = z.infer<typeof zProtocolErrorResponse>;
