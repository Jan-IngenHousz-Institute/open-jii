import { z } from "zod";

import { zExperimentCallerRole, zExperimentStatus } from "../experiment/experiment.schema";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";

/** The types whose overview page records a visit. */
export const zVisitedResourceType = z.enum(["experiment", "protocol", "macro", "workbook"]);

export const zRecordVisitBody = z.object({
  resourceType: zVisitedResourceType.describe("Type of the opened resource"),
  resourceId: z.string().guid().describe("ID of the opened resource"),
});

const zRecentlyOpenedBase = z.object({
  id: z.string().guid(),
  name: z.string(),
  /** When the caller last opened the resource's overview. */
  openedAt: z.string().datetime(),
  /** Null when no role reaches the caller, such as on a public resource. */
  callerRole: zExperimentCallerRole.nullable(),
});

/** One opened resource, with the one fact its own listing shows beside the name. */
export const zRecentlyOpenedResource = z.discriminatedUnion("type", [
  zRecentlyOpenedBase.extend({
    type: z.literal("experiment"),
    status: zExperimentStatus,
    organizationName: z.string().nullable(),
  }),
  zRecentlyOpenedBase.extend({ type: z.literal("protocol"), family: zSensorFamily }),
  zRecentlyOpenedBase.extend({ type: z.literal("macro"), language: zMacroLanguage }),
  zRecentlyOpenedBase.extend({
    type: z.literal("workbook"),
    /** Null while the workbook has never been published. */
    latestVersion: z.number().int().positive().nullable(),
  }),
]);

export const zRecentlyOpened = z.object({
  items: z.array(zRecentlyOpenedResource),
  /** Every type with at least one row to show, whichever `type` was asked for. */
  types: z.array(zVisitedResourceType),
});

/** Applied server-side when the caller sends no `limit`. */
export const DEFAULT_RECENTLY_OPENED_RESOURCES_LIMIT = 5;

export const zRecentlyOpenedQuery = z.object({
  type: zVisitedResourceType.optional().describe("Only this type, every type by default"),
  limit: z.coerce.number().int().min(1).max(20).optional().describe("Rows to return, 5 by default"),
});

export type VisitedResourceType = z.infer<typeof zVisitedResourceType>;
export type RecordVisitBody = z.infer<typeof zRecordVisitBody>;
export type RecentlyOpenedResource = z.infer<typeof zRecentlyOpenedResource>;
export type RecentlyOpened = z.infer<typeof zRecentlyOpened>;
export type RecentlyOpenedQuery = z.infer<typeof zRecentlyOpenedQuery>;
