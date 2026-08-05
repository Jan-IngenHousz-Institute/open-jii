import { z } from "zod";

import { sanitizeQuestionLabel } from "../../transforms/label-sanitization";
import { zCommandFormat, zExperimentQuestionContent } from "../experiment/experiment.schema";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";

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

// An inline command cell sends a raw string (e.g. `hello`, `battery`), JSON, or
// YAML straight to the device. Kept as a separate cell type (not folded into
// the protocol cell) so old mobile apps, whose bundled cells->flow only knows
// "protocol", keep rendering protocol cells and simply skip command cells.
const zCommandPayload = z
  .object({
    format: zCommandFormat,
    content: z.string().min(1, "Command content is required"),
    name: z.string().optional(),
  })
  .strict();

export const zCommandCell = zBaseCell.extend({
  type: z.literal("command"),
  payload: zCommandPayload,
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

export const zBranchCondition = z.object({
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

// One device's outcome from a multi-device run; exactly one of data/error set.
export const zOutputDeviceResult = z.object({
  deviceId: z.string(),
  deviceLabel: z.string().optional(),
  // Identified sensor family and device-reported name, when the handshake resolved them.
  family: zSensorFamily.optional(),
  deviceName: z.string().optional(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export const zOutputCell = zBaseCell.extend({
  type: z.literal("output"),
  producedBy: z.string().min(1, "Producer cell ID is required"),
  // Primary device's result; single-device runs carry only this.
  data: z.unknown().optional(),
  executionTime: z.number().nonnegative().optional(),
  messages: z.array(z.string()).optional(),
  // Per-device results when the run fanned out to several connected devices.
  deviceResults: z.array(zOutputDeviceResult).optional(),
});

export const zMarkdownCell = zBaseCell.extend({
  type: z.literal("markdown"),
  content: z.string(),
});

// Deliberately non-recursive. Parallel containers are shallow in v1, so a
// lane body accepts every ordinary workbook cell but cannot contain another
// parallel container (and the schema has no circular self-reference).
export const zParallelBodyCell = z.union([
  zProtocolCell,
  zCommandCell,
  zMacroCell,
  zQuestionCell,
  zBranchCell,
  zOutputCell,
  zMarkdownCell,
]);

export const zParallelLane = z.object({
  id: z.string().min(1, "Lane ID is required"),
  label: z.string().max(64),
  color: z.string(),
  conditions: z.array(zBranchCondition),
  body: z.array(zParallelBodyCell),
});

export const zParallelCell = zBaseCell.extend({
  type: z.literal("parallel"),
  name: z
    .string()
    .min(1, "Parallel container name is required")
    .max(64, "Parallel container name must be 64 characters or less"),
  defaultLaneId: z.string().optional(),
  lanes: z.array(zParallelLane).min(1, "At least one parallel lane is required"),
});

export const zWorkbookCell = z.union([
  zProtocolCell,
  zCommandCell,
  zMacroCell,
  zQuestionCell,
  zBranchCell,
  zOutputCell,
  zMarkdownCell,
  zParallelCell,
]);

// Plain cell array for OUTPUT schemas. Read paths must accept whatever is persisted:
// rows written before a rule was added (or under an older contract) still have to
// serialize, otherwise oRPC output validation turns one legacy row into a 500.
export const zWorkbookCellArray = z.array(zWorkbookCell);

// Input-side variant with cross-cell rules; use wherever clients submit cells.
export const zWorkbookCellArrayInput = zWorkbookCellArray.superRefine((cells, ctx) => {
  // Canonicalised duplicate names collide as column/context keys. Question
  // and container names are checked across the whole shallow cell tree.
  const questionNames = new Map<string, (string | number)[]>();
  const parallelNames = new Map<string, (string | number)[]>();
  const cellIds = new Map<string, (string | number)[]>();

  const visit = (body: z.infer<typeof zWorkbookCell>[], path: (string | number)[]) => {
    body.forEach((cell, index) => {
      const cellPath = [...path, index];
      const previousId = cellIds.get(cell.id);
      if (previousId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Cell ID "${cell.id}" must be unique across the workbook`,
          path: [...cellPath, "id"],
        });
      } else {
        cellIds.set(cell.id, cellPath);
      }

      if (cell.type === "question") {
        const canonical = sanitizeQuestionLabel(cell.name);
        if (questionNames.has(canonical)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question cell name "${cell.name}" must be unique`,
            path: [...cellPath, "name"],
          });
        } else {
          questionNames.set(canonical, cellPath);
        }
      }

      if (cell.type !== "parallel") return;
      const canonical = sanitizeQuestionLabel(cell.name);
      if (parallelNames.has(canonical)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Parallel container name "${cell.name}" must be unique`,
          path: [...cellPath, "name"],
        });
      } else {
        parallelNames.set(canonical, cellPath);
      }

      const laneIds = new Set<string>();
      cell.lanes.forEach((lane, laneIndex) => {
        if (laneIds.has(lane.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Lane ID "${lane.id}" must be unique within the container`,
            path: [...cellPath, "lanes", laneIndex, "id"],
          });
        }
        laneIds.add(lane.id);
        visit(lane.body, [...cellPath, "lanes", laneIndex, "body"]);
      });

      const defaultResolution = resolveParallelDefaultLane(cell);
      if (cell.defaultLaneId && defaultResolution.kind !== "resolved") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Default lane "${cell.defaultLaneId}" must resolve to exactly one lane`,
          path: [...cellPath, "defaultLaneId"],
        });
      }
    });
  };

  visit(cells, []);
});

export type ProtocolCell = z.infer<typeof zProtocolCell>;
export type CommandCell = z.infer<typeof zCommandCell>;
export type MacroCell = z.infer<typeof zMacroCell>;
export type QuestionCell = z.infer<typeof zQuestionCell>;
export type BranchCell = z.infer<typeof zBranchCell>;
export type BranchCondition = z.infer<typeof zBranchCondition>;
export type BranchPath = z.infer<typeof zBranchPath>;
export type OutputCell = z.infer<typeof zOutputCell>;
export type OutputDeviceResult = z.infer<typeof zOutputDeviceResult>;
export type MarkdownCell = z.infer<typeof zMarkdownCell>;
export type ParallelBodyCell = z.infer<typeof zParallelBodyCell>;
export type ParallelLane = z.infer<typeof zParallelLane>;
export type ParallelCell = z.infer<typeof zParallelCell>;

export type ParallelDefaultLaneResolution =
  | { kind: "resolved"; lane: ParallelLane }
  | { kind: "absent"; defaultLaneId: string | undefined }
  | { kind: "ambiguous"; defaultLaneId: string; lanes: ParallelLane[] };

/**
 * Resolve the default by object identity. Callers must handle absent and
 * ambiguous ids explicitly; no host may silently choose the first duplicate.
 */
export function resolveParallelDefaultLane(
  container: Pick<ParallelCell, "defaultLaneId" | "lanes">,
): ParallelDefaultLaneResolution {
  const { defaultLaneId } = container;
  if (!defaultLaneId) return { kind: "absent", defaultLaneId };
  const lanes = container.lanes.filter((lane) => lane.id === defaultLaneId);
  if (lanes.length === 1) return { kind: "resolved", lane: lanes[0] };
  if (lanes.length === 0) return { kind: "absent", defaultLaneId };
  return { kind: "ambiguous", defaultLaneId, lanes };
}

export type WorkbookCell =
  | ProtocolCell
  | CommandCell
  | MacroCell
  | QuestionCell
  | BranchCell
  | OutputCell
  | MarkdownCell
  | ParallelCell;

/**
 * The author-facing name a cell contributes to the macro `ctx` namespace.
 * Undefined for cell types that never produce a namespace entry.
 */
export function namespaceNameOf(cell: WorkbookCell): string | undefined {
  switch (cell.type) {
    case "question":
      return cell.name;
    case "protocol":
    case "macro":
    case "command":
      return cell.payload.name;
    case "parallel":
      return sanitizeQuestionLabel(cell.name);
    default:
      return undefined;
  }
}
