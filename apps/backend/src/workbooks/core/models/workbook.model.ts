import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import { workbooks } from "@repo/database";

export const createWorkbookSchema = createInsertSchema(workbooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  searchVector: true,
});

export const updateWorkbookSchema = createInsertSchema(workbooks).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  searchVector: true,
});

export const selectWorkbookSchema = createSelectSchema(workbooks)
  .omit({ searchVector: true })
  .extend({
    cells: zWorkbookCellArray,
    metadata: z.record(z.string(), z.unknown()),
    createdByName: z.string().optional(),
    /** Display name of the owning organization; `null` for a personal workspace. */
    organizationName: z.string().nullish(),
    isUpgradable: z.boolean().optional(),
    experimentCount: z.number().int().nonnegative().optional(),
  });

// List rows carry no `cells`: they dominate the payload and per-cell validation of
// every row would let one legacy workbook 500 the whole collection endpoint.
// `cellTypeCounts` is the SQL-computed projection the list UI needs instead.
export const selectWorkbookListItemSchema = selectWorkbookSchema.omit({ cells: true }).extend({
  cellTypeCounts: z.record(z.string(), z.number()).optional(),
});

export type CreateWorkbookDto = z.infer<typeof createWorkbookSchema>;
export type UpdateWorkbookDto = z.infer<typeof updateWorkbookSchema>;
export type WorkbookDto = z.infer<typeof selectWorkbookSchema>;
export type WorkbookListItemDto = z.infer<typeof selectWorkbookListItemSchema>;
