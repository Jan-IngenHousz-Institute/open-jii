import { z } from "zod";

import { zMacroLanguage } from "../macro/macro.schema";
import { zProtocolFamily } from "../protocol/protocol.schema";
import { zWorkbookCellArray } from "./workbook-cells.schema";

// `family` and macro `language` are captured at publish so the pinned snapshot
// runs without the live row; the cell payload's language can go stale when the
// macro row is edited elsewhere. Optional for versions published before that.
export const zEntitySnapshots = z.object({
  protocols: z.record(
    z.string(),
    z.object({ code: z.unknown(), family: zProtocolFamily.optional() }),
  ),
  macros: z.record(z.string(), z.object({ code: z.string(), language: zMacroLanguage.optional() })),
});

export const zWorkbookVersion = z.object({
  id: z.string().guid(),
  workbookId: z.string().guid(),
  version: z.number().int().positive(),
  cells: zWorkbookCellArray,
  metadata: z.record(z.string(), z.unknown()),
  entitySnapshots: zEntitySnapshots.optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().guid(),
});

export const zWorkbookVersionSummary = z.object({
  id: z.string().guid(),
  workbookId: z.string().guid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  createdBy: z.string().guid(),
});

export const zWorkbookVersionList = z.array(zWorkbookVersionSummary);

export const zWorkbookVersionIdPathParam = z.object({
  id: z.string().guid(),
  versionId: z.string().guid(),
});

export const zWorkbookVersionErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

export const zAttachWorkbookBody = z.object({
  workbookId: z.string().guid(),
});

export const zSetWorkbookVersionBody = z.object({
  versionId: z.string().guid(),
});

export const zAttachWorkbookResponse = z.object({
  workbookId: z.string().guid(),
  workbookVersionId: z.string().guid(),
  version: z.number().int().positive(),
});

export type WorkbookVersion = z.infer<typeof zWorkbookVersion>;
export type WorkbookVersionSummary = z.infer<typeof zWorkbookVersionSummary>;
export type WorkbookVersionList = z.infer<typeof zWorkbookVersionList>;
export type AttachWorkbookBody = z.infer<typeof zAttachWorkbookBody>;
export type SetWorkbookVersionBody = z.infer<typeof zSetWorkbookVersionBody>;
export type AttachWorkbookResponse = z.infer<typeof zAttachWorkbookResponse>;
export type EntitySnapshots = z.infer<typeof zEntitySnapshots>;
