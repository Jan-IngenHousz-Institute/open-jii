import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zWorkbookCellArray } from "@repo/api";
import { workbookVersions } from "@repo/database";

export const createWorkbookVersionSchema = createInsertSchema(workbookVersions)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    cells: zWorkbookCellArray,
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

export const selectWorkbookVersionSchema = createSelectSchema(workbookVersions).extend({
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
});

export type CreateWorkbookVersionDto = z.infer<typeof createWorkbookVersionSchema>;
export type WorkbookVersionDto = z.infer<typeof selectWorkbookVersionSchema>;
