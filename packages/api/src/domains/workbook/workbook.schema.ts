import { z } from "zod";

import { zWorkbookCellArray } from "./workbook-cells.schema";

export const zWorkbook = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  organizationId: z.string().uuid().nullable(),
  visibility: z.enum(["private", "public"]),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  forkedFrom: z.string().uuid().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isUpgradable: z.boolean().optional(),
  experimentCount: z.number().int().nonnegative().optional(),
});

export const zWorkbookList = z.array(zWorkbook);

export const zWorkbookFilterQuery = z.object({
  search: z.string().optional(),
  filter: z.enum(["my"]).optional(),
});

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
  cells: zWorkbookCellArray.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Set when duplicating an existing workbook, to record its lineage.
  forkedFrom: z.string().uuid().optional(),
  // Optional target organization to create into; defaults to the creator's
  // personal org. The caller must be a member of the given organization.
  organizationId: z.string().uuid().optional(),
});

export const zUpdateWorkbookRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z.string().optional(),
  cells: zWorkbookCellArray.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const zWorkbookErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

export type Workbook = z.infer<typeof zWorkbook>;
export type WorkbookList = z.infer<typeof zWorkbookList>;
export type WorkbookFilterQuery = z.infer<typeof zWorkbookFilterQuery>;
export type WorkbookIdPathParam = z.infer<typeof zWorkbookIdPathParam>;
export type CreateWorkbookRequestBody = z.infer<typeof zCreateWorkbookRequestBody>;
export type UpdateWorkbookRequestBody = z.infer<typeof zUpdateWorkbookRequestBody>;
export type WorkbookErrorResponse = z.infer<typeof zWorkbookErrorResponse>;
