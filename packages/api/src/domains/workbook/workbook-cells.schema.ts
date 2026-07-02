import { z } from "zod";

import { sanitizeQuestionLabel } from "../../transforms/label-sanitization";
import { zExperimentQuestionContent } from "../experiment/experiment.schema";
import { zMacroLanguage } from "../macro/macro.schema";

const zBaseCell = z.object({
  id: z.string().min(1, "Cell ID is required"),
  isCollapsed: z.boolean().optional().default(false),
});

const zProtocolPayload = z
  .object({
    protocolId: z.string().uuid(),
    version: z.number().int().positive(),
    name: z.string().optional(),
  })
  .strict();

export const zProtocolCell = zBaseCell.extend({
  type: z.literal("protocol"),
  payload: zProtocolPayload,
});

// Macros are always persisted entities; the cell stores a ref. Versioning happens at the experiment/snapshot level.
const zMacroPayload = z
  .object({
    macroId: z.string().uuid(),
    language: zMacroLanguage,
    name: z.string().optional(),
  })
  .strict();

export const zMacroCell = zBaseCell.extend({
  type: z.literal("macro"),
  payload: zMacroPayload,
});

export const zQuestionCell = zBaseCell.extend({
  type: z.literal("question"),
  // Data pipeline canonicalises this into a column key in `questions_data`; must be unique within the workbook.
  name: z
    .string()
    .min(1, "Question name is required")
    .max(64, "Question name must be 64 characters or less"),
  question: zExperimentQuestionContent,
  answer: z.string().optional(),
  isAnswered: z.boolean().optional().default(false),
});

const zBranchOperator = z.enum(["eq", "neq", "gt", "lt", "gte", "lte"]);

const zBranchCondition = z.object({
  id: z.string().min(1, "Condition ID is required"),
  sourceCellId: z.string(),
  field: z.string(),
  operator: zBranchOperator,
  value: z.string(),
});

const zBranchPath = z.object({
  id: z.string().min(1, "Path ID is required"),
  label: z.string().max(64),
  color: z.string(),
  conditions: z.array(zBranchCondition),
  gotoCellId: z.string().optional(),
});

export const zBranchCell = zBaseCell.extend({
  type: z.literal("branch"),
  paths: z.array(zBranchPath).min(1),
  defaultPathId: z.string().optional(),
  evaluatedPathId: z.string().optional(),
});

export const zOutputCell = zBaseCell.extend({
  type: z.literal("output"),
  producedBy: z.string().min(1, "Producer cell ID is required"),
  data: z.unknown().optional(),
  executionTime: z.number().nonnegative().optional(),
  messages: z.array(z.string()).optional(),
});

export const zMarkdownCell = zBaseCell.extend({
  type: z.literal("markdown"),
  content: z.string(),
});

export const zWorkbookCell = z.union([
  zProtocolCell,
  zMacroCell,
  zQuestionCell,
  zBranchCell,
  zOutputCell,
  zMarkdownCell,
]);

export const zWorkbookCellArray = z.array(zWorkbookCell).superRefine((cells, ctx) => {
  // Canonicalised duplicate names collide as column keys in `questions_data` and lose answers. Mirrors zFlowGraph.
  const seen = new Map<string, number>();
  cells.forEach((cell, index) => {
    if (cell.type !== "question") return;
    const canonical = sanitizeQuestionLabel(cell.name);
    if (seen.has(canonical)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question cell name "${cell.name}" must be unique`,
        path: [index, "name"],
      });
      return;
    }
    seen.set(canonical, index);
  });
});

export type ProtocolCell = z.infer<typeof zProtocolCell>;
export type MacroCell = z.infer<typeof zMacroCell>;
export type QuestionCell = z.infer<typeof zQuestionCell>;
export type BranchCell = z.infer<typeof zBranchCell>;
export type BranchCondition = z.infer<typeof zBranchCondition>;
export type BranchPath = z.infer<typeof zBranchPath>;
export type OutputCell = z.infer<typeof zOutputCell>;
export type MarkdownCell = z.infer<typeof zMarkdownCell>;

export type WorkbookCell =
  | ProtocolCell
  | MacroCell
  | QuestionCell
  | BranchCell
  | OutputCell
  | MarkdownCell;
