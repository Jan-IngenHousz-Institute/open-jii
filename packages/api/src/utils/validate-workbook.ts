import type { SensorFamily } from "../schemas/protocol.schema";
import type { WorkbookCell } from "../schemas/workbook-cells.schema";

export type WorkbookIssueLevel = "error" | "warning";

export type WorkbookIssueCode =
  | "missing-protocol"
  | "missing-macro"
  | "dangling-branch-source"
  | "dangling-branch-goto"
  | "mixed-sensor-families"
  | "macro-without-input";

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

  for (const cell of cells) {
    if (cell.type === "protocol") {
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

    if (cell.type === "macro" && !(cell.payload.macroId in ctx.macros)) {
      issues.push({
        level: "error",
        code: "missing-macro",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
        ref: cell.payload.macroId,
      });
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

  // A macro ultimately consumes the output of an upstream measurement.
  // Approximate that as "some protocol cell precedes it in document order" so a
  // protocol-less macro chain flags every macro, not just the first.
  cells.forEach((cell, index) => {
    if (cell.type !== "macro") return;
    const hasUpstream = cells.slice(0, index).some((c) => c.type === "protocol");
    if (!hasUpstream) {
      issues.push({
        level: "warning",
        code: "macro-without-input",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
      });
    }
  });

  if (families.size > 1) {
    issues.push({
      level: "warning",
      code: "mixed-sensor-families",
      detail: [...families].sort().join(", "),
    });
  }

  return { issues, ok: !issues.some((i) => i.level === "error") };
}
