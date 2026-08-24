import { z } from "zod";

import { zPaginated, zPaginationQuery, zResourceScope } from "../../shared/listing";
import { zResourceCapabilities } from "../authorization/capabilities.schema";
import { zVisibility } from "../visibility/visibility.schema";
import { zWorkbookCellArray, zWorkbookCellArrayInput } from "./workbook-cells.schema";

export const zWorkbook = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  organizationId: z.string().uuid().nullable(),
  /**
   * Display name of the owning organization, `null` for a personal workspace.
   * Populated by the detail read only — the lists have no room for it — which is
   * why it is optional rather than required.
   */
  organizationName: z.string().nullish(),
  visibility: z.enum(["private", "public"]),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  forkedFrom: z.string().uuid().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isUpgradable: z.boolean().optional(),
  experimentCount: z.number().int().nonnegative().optional(),
});

// List rows omit `cells`: they dominate the payload (output cells embed run data)
// and one legacy row failing cell validation must not 500 the whole collection.
// `cellTypeCounts` is the cheap projection list badges need, computed in SQL so it
// works regardless of whether the stored cells still parse under the current contract.
export const zWorkbookListItem = zWorkbook.omit({ cells: true }).extend({
  cellTypeCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export const zWorkbookList = z.array(zWorkbookListItem);

/**
 * A single workbook plus the caller's effective capabilities on it. Detail route
 * only — see `zMacroDetail` for why list rows stay plain.
 */
export const zWorkbookDetail = zWorkbook.extend({
  capabilities: zResourceCapabilities,
});

export const zWorkbookFilterQuery = z.object({
  search: z.string().optional(),
  /** @deprecated Alias for `scope: "related"`, removed once web and mobile have migrated. */
  filter: z.enum(["my"]).optional().describe("Deprecated alias for scope=related"),
  scope: zResourceScope.optional().describe("Which slice of the accessible set to return"),
});

export const zWorkbookPaginatedQuery = zWorkbookFilterQuery.merge(zPaginationQuery);

export const zWorkbookPaginatedList = zPaginated(zWorkbookListItem);

export const zWorkbookIdPathParam = z.object({
  id: z.string().uuid(),
});

export const zCreateWorkbookRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z.string().optional(),
  cells: zWorkbookCellArrayInput.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Set when duplicating an existing workbook, to record its lineage.
  forkedFrom: z.string().uuid().optional(),
  // Optional target organization to create into; defaults to the creator's
  // personal org. The caller must be a member of the given organization.
  organizationId: z.string().uuid().optional(),
  // Visibility at creation: defaults to public. Post-create changes go through the
  // dedicated `setVisibility` route only, which is monotonic (private→public); the
  // update body never carries visibility.
  visibility: zVisibility.optional(),
});

export const zUpdateWorkbookRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z.string().optional(),
  cells: zWorkbookCellArrayInput.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const zWorkbookErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

export type Workbook = z.infer<typeof zWorkbook>;
export type WorkbookDetail = z.infer<typeof zWorkbookDetail>;
export type WorkbookListItem = z.infer<typeof zWorkbookListItem>;
export type WorkbookList = z.infer<typeof zWorkbookList>;
export type WorkbookFilterQuery = z.infer<typeof zWorkbookFilterQuery>;
export type WorkbookPaginatedQuery = z.infer<typeof zWorkbookPaginatedQuery>;
export type WorkbookPaginatedList = z.infer<typeof zWorkbookPaginatedList>;
export type WorkbookIdPathParam = z.infer<typeof zWorkbookIdPathParam>;
export type CreateWorkbookRequestBody = z.infer<typeof zCreateWorkbookRequestBody>;
export type UpdateWorkbookRequestBody = z.infer<typeof zUpdateWorkbookRequestBody>;
export type WorkbookErrorResponse = z.infer<typeof zWorkbookErrorResponse>;
