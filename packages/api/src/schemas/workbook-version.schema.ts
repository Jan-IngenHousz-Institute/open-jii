import { z } from "zod";

import { zWorkbookCellArray } from "./workbook-cells.schema";

export const zWorkbookVersion = z.object({
  id: z.string().uuid(),
  workbookId: z.string().uuid(),
  version: z.number().int().positive(),
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});

export const zWorkbookVersionSummary = z.object({
  id: z.string().uuid(),
  workbookId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});

export const zWorkbookVersionList = z.array(zWorkbookVersionSummary);

export const zWorkbookVersionIdPathParam = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const zWorkbookVersionErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

export const zAttachWorkbookBody = z.object({
  workbookId: z.string().uuid(),
});

export const zAttachWorkbookResponse = z.object({
  workbookId: z.string().uuid(),
  workbookVersionId: z.string().uuid(),
  version: z.number().int().positive(),
});

export type WorkbookVersion = z.infer<typeof zWorkbookVersion>;
export type WorkbookVersionSummary = z.infer<typeof zWorkbookVersionSummary>;
export type WorkbookVersionList = z.infer<typeof zWorkbookVersionList>;
export type AttachWorkbookBody = z.infer<typeof zAttachWorkbookBody>;
export type AttachWorkbookResponse = z.infer<typeof zAttachWorkbookResponse>;
