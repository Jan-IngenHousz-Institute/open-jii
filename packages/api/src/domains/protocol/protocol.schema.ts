import { z } from "zod";

import { zResourceCapabilities } from "../authorization/capabilities.schema";
import { zVisibility } from "../visibility/visibility.schema";

export const zSensorFamily = z.enum([
  "multispeq",
  "ambyte",
  "minipar",
  "generic",
  "ambit",
  "mobile",
]);

// Phones self-register and never carry authored protocols; the family exists
// for devices only, so protocol authoring rejects it at the contract.
export const zProtocolFamily = zSensorFamily.exclude(["mobile"]);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Any valid JSON value. A protocol's code shape is device-defined: MultispeQ
 * protocols are always arrays of protocol sets, but other families define
 * their own shape, so `code` accepts any JSON document.
 */
export const zJsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(zJsonValue),
    z.record(zJsonValue),
  ]),
);

// Define Zod schemas for protocol models
export const zProtocol = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  code: zJsonValue,
  family: zProtocolFamily,
  sortOrder: z.number().nullable(),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  forkedFrom: z.string().uuid().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  organizationId: z.string().uuid().nullable(),
  visibility: z.enum(["private", "public"]),
});
// List rows intentionally skip recursive code validation. A protocol document
// can be large, and oRPC validates every output synchronously; detail and
// mutation responses keep the precise zJsonValue boundary through zProtocol.
export const zProtocolList = z.array(zProtocol.extend({ code: z.unknown() }));

/**
 * A single protocol plus the caller's effective capabilities on it. Detail route
 * only — see `zMacroDetail` for why list rows stay plain.
 */
export const zProtocolDetail = zProtocol.extend({
  capabilities: zResourceCapabilities,
});

// Query parameters
export const zProtocolFilterQuery = z.object({
  search: z.string().optional(),
  filter: z.enum(["my"]).optional(),
});

// Path parameters
export const zProtocolIdPathParam = z.object({
  id: z.string().uuid(),
});

// Request body schemas
export const zCreateProtocolRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z.string().optional(),
  code: zJsonValue,
  family: zProtocolFamily,
  // Set when this protocol is a fork (copy) of another, to record its lineage.
  forkedFrom: z.string().uuid().optional(),
  // Optional target organization to create into; defaults to the creator's
  // personal org. The caller must be a member of the given organization.
  organizationId: z.string().uuid().optional(),
  // Visibility at creation: defaults to public. Post-create changes go through the
  // dedicated `setVisibility` route only, which is monotonic (private→public); the
  // update body never carries visibility.
  visibility: zVisibility.optional(),
});

export const zUpdateProtocolRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z.string().optional(),
  code: zJsonValue.optional(),
  family: zProtocolFamily.optional(),
});

// Error response
export const zProtocolErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

// Protocol-Macro compatibility schemas
export const zCompatibleMacroSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filename: z.string(),
  language: z.enum(["python", "r", "javascript"]),
  createdBy: z.string().uuid(),
});

export const zProtocolMacroEntry = z.object({
  protocolId: z.string().uuid(),
  macro: zCompatibleMacroSummary,
  addedAt: z.string().datetime(),
});

export const zProtocolMacroList = z.array(zProtocolMacroEntry);

export const zAddCompatibleMacrosBody = z.object({
  // Capped so a single request can't fan out into an unbounded set of per-id
  // authorization checks (each link target is read-access validated server-side).
  macroIds: z.array(z.string().uuid()).min(1).max(100),
});

export const zProtocolMacroPathParams = z.object({
  id: z.string().uuid(),
  macroId: z.string().uuid(),
});

// Infer types from Zod schemas
export type SensorFamily = z.infer<typeof zSensorFamily>;
export type ProtocolFamily = z.infer<typeof zProtocolFamily>;
export type Protocol = z.infer<typeof zProtocol>;
export type ProtocolDetail = z.infer<typeof zProtocolDetail>;
export type ProtocolList = z.infer<typeof zProtocolList>;
export type ProtocolListItem = ProtocolList[number];
export type ProtocolFilterQuery = z.infer<typeof zProtocolFilterQuery>;
export type ProtocolFilter = ProtocolFilterQuery["search"];
export type ProtocolIdPathParam = z.infer<typeof zProtocolIdPathParam>;
export type CreateProtocolRequestBody = z.infer<typeof zCreateProtocolRequestBody>;
export type UpdateProtocolRequestBody = z.infer<typeof zUpdateProtocolRequestBody>;
export type ProtocolErrorResponse = z.infer<typeof zProtocolErrorResponse>;
export type CompatibleMacroSummary = z.infer<typeof zCompatibleMacroSummary>;
export type ProtocolMacroEntry = z.infer<typeof zProtocolMacroEntry>;
export type ProtocolMacroList = z.infer<typeof zProtocolMacroList>;
export type AddCompatibleMacrosBody = z.infer<typeof zAddCompatibleMacrosBody>;
