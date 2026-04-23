import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zWorkbookCellArray } from "@repo/api";
import { workbooks } from "@repo/database";

export const createWorkbookSchema = createInsertSchema(workbooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateWorkbookSchema = createInsertSchema(workbooks).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const selectWorkbookSchema = createSelectSchema(workbooks).extend({
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  createdByName: z.string().optional(),
});

export type CreateWorkbookDto = z.infer<typeof createWorkbookSchema>;
export type UpdateWorkbookDto = z.infer<typeof updateWorkbookSchema>;
export type WorkbookDto = z.infer<typeof selectWorkbookSchema>;
