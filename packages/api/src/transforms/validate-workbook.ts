import type { SensorFamily } from "../domains/protocol/protocol.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { validateDynamicCommandReferences } from "./dynamic-command-refs";
import type { DynamicCommandIssueCode } from "./dynamic-command-refs";

export type WorkbookIssueLevel = "error" | "warning";

export type WorkbookIssueCode =
  | "missing-protocol"
  | "missing-macro"
  | "dangling-branch-source"
  | "dangling-branch-goto"
  | "mixed-sensor-families"
  | "macro-without-input"
  | DynamicCommandIssueCode;

export interface WorkbookIssue {
  level: WorkbookIssueLevel;
  code: WorkbookIssueCode;
  /** Cell the issue is anchored to; absent for workbook-wide issues. */
  cellId?: string;
  /** Display label for the offending cell, when it has one. */
  cellLabel?: string;
  /** Unresolved reference (entity id or target cell id). */
  ref?: string;
  /** Extra value for message interpolation (e.g. the family list). */
  detail?: string;
}

export interface WorkbookValidationContext {
  /** Referenced protocols by id with sensor family. A missing id means the protocol no longer exists. */
  protocols: Record<string, { family?: SensorFamily } | undefined>;
  /** Referenced macros by id. A missing id means the macro no longer exists. */
  macros: Record<string, unknown>;
}

export interface WorkbookValidationResult {
  issues: WorkbookIssue[];
  /** True when there are no blocking errors (warnings are allowed). */
  ok: boolean;
}

function cellLabelOf(cell: WorkbookCell): string | undefined {
  switch (cell.type) {
    case "protocol":
    case "macro":
      return cell.payload.name;
    case "question":
      return cell.name;
    default:
      return undefined;
  }
}

/**
 * Static, device-free structural checks for a workbook's cells. Catches the
 * breakages a shared-entity edit or a version upgrade can introduce: references
 * to cells/entities that no longer exist, more than one sensor family in a
 * single flow, and a macro with nothing upstream to run on. It intentionally
 * does NOT (and cannot) verify macro logic, protocol output shape, or device
 * behaviour, so a clean result is "no structural problems", not "guaranteed to
 * run".
 */
export function validateWorkbook(
  cells: WorkbookCell[],
  ctx: WorkbookValidationContext,
): WorkbookValidationResult {
  const issues: WorkbookIssue[] = [];
  const cellIds = new Set(cells.map((c) => c.id));
  const families = new Set<SensorFamily>();
  const seenBranchRefs = new Set<string>();
  // A macro ultimately consumes the output of an upstream measurement. Approximate
  // that as "some protocol cell precedes it in document order" so a protocol-less
  // macro chain flags every macro, not just the first. Tracked in one pass (O(n)).
  let sawProtocol = false;

  for (const cell of cells) {
    if (cell.type === "protocol") {
      sawProtocol = true;
      const protocol = ctx.protocols[cell.payload.protocolId];
      if (!protocol) {
        issues.push({
          level: "error",
          code: "missing-protocol",
          cellId: cell.id,
          cellLabel: cellLabelOf(cell),
          ref: cell.payload.protocolId,
        });
      } else if (protocol.family) {
        families.add(protocol.family);
      }
    }

    if (cell.type === "macro") {
      if (!(cell.payload.macroId in ctx.macros)) {
        issues.push({
          level: "error",
          code: "missing-macro",
          cellId: cell.id,
          cellLabel: cellLabelOf(cell),
          ref: cell.payload.macroId,
        });
      }
      if (!sawProtocol) {
        issues.push({
          level: "warning",
          code: "macro-without-input",
          cellId: cell.id,
          cellLabel: cellLabelOf(cell),
        });
      }
    }

    if (cell.type === "branch") {
      for (const path of cell.paths) {
        for (const cond of path.conditions) {
          const key = `s:${cell.id}:${cond.sourceCellId}`;
          if (cond.sourceCellId && !cellIds.has(cond.sourceCellId) && !seenBranchRefs.has(key)) {
            seenBranchRefs.add(key);
            issues.push({
              level: "error",
              code: "dangling-branch-source",
              cellId: cell.id,
              cellLabel: cellLabelOf(cell),
              ref: cond.sourceCellId,
            });
          }
        }
        const gotoKey = `g:${cell.id}:${path.gotoCellId}`;
        if (path.gotoCellId && !cellIds.has(path.gotoCellId) && !seenBranchRefs.has(gotoKey)) {
          seenBranchRefs.add(gotoKey);
          issues.push({
            level: "error",
            code: "dangling-branch-goto",
            cellId: cell.id,
            cellLabel: cellLabelOf(cell),
            ref: path.gotoCellId,
          });
        }
      }
    }
  }

  if (families.size > 1) {
    issues.push({
      level: "warning",
      code: "mixed-sensor-families",
      detail: [...families].sort().join(", "),
    });
  }

  // Blocking structural problems with dynamic command references. The backend
  // publish path is the enforcement point; this surfaces the same codes to the
  // editor. cellId/ref carry the command cell and its referenced source.
  for (const issue of validateDynamicCommandReferences(cells)) {
    issues.push({
      level: "error",
      code: issue.code,
      cellId: issue.commandCellId,
      ref: issue.sourceCellId,
      detail: issue.field || undefined,
    });
  }

  return { issues, ok: !issues.some((i) => i.level === "error") };
}
