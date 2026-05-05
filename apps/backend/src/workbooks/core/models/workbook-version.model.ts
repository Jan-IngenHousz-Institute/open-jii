import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zWorkbookCellArray } from "@repo/api/schemas/workbook-cells.schema";
import { zEntitySnapshots } from "@repo/api/schemas/workbook-version.schema";
import { workbookVersions } from "@repo/database";

export const createWorkbookVersionSchema = createInsertSchema(workbookVersions)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    cells: zWorkbookCellArray,
    metadata: z.record(z.string(), z.unknown()).optional(),
    entitySnapshots: zEntitySnapshots.optional(),
  });

export const selectWorkbookVersionSchema = createSelectSchema(workbookVersions).extend({
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  entitySnapshots: zEntitySnapshots,
});

export type CreateWorkbookVersionDto = z.infer<typeof createWorkbookVersionSchema>;
export type WorkbookVersionDto = z.infer<typeof selectWorkbookVersionSchema>;
