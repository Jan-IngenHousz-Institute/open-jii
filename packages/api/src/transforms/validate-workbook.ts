import type { SensorFamily } from "../domains/protocol/protocol.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { resolveParallelDefaultLane } from "../domains/workbook/workbook-cells.schema";
import { DEVICE_CONTEXT_KEY } from "./device-context";
import {
  isDeviceScopedBranch,
  isGotoBranchCell,
  resolveBranchDefaultPath,
} from "./evaluate-branch";
import { sanitizeQuestionLabel } from "./label-sanitization";
import {
  cellPathKey,
  resolveCellScope,
  sameCellPath,
  walkWorkbookCells,
} from "./workbook-cell-tree";

export type WorkbookIssueLevel = "error" | "warning";

export type WorkbookIssueCode =
  | "missing-protocol"
  | "missing-macro"
  | "dangling-branch-source"
  | "dangling-branch-goto"
  | "mixed-sensor-families"
  | "macro-without-input"
  | "unreachable-cell"
  | "backward-goto-loop"
  | "branch-no-default"
  | "duplicate-branch-path-id"
  | "path-duplicate-conditions"
  | "PARALLEL_LANE_EMPTY"
  | "PARALLEL_NO_DEFAULT_LANE"
  | "PARALLEL_MULTIPLE_DEFAULT_LANES"
  | "PARALLEL_LANE_ID_DUPLICATE"
  | "PARALLEL_CELL_ID_DUPLICATE"
  | "PARALLEL_NAME_DUPLICATE"
  | "PARALLEL_REF_CROSSES_LANE"
  | "PARALLEL_REF_INTO_BODY"
  | "CONTAINER_BRANCH_ESCAPES_BODY"
  | "CONTAINER_NESTING_UNSUPPORTED";

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
    case "parallel":
      return cell.name;
    default:
      return undefined;
  }
}

function duplicateConditionKey(
  cell: Extract<WorkbookCell, { type: "branch" }>,
): Map<(typeof cell.paths)[number], string> {
  const firstPathByConditions = new Map<string, string>();
  const duplicates = new Map<(typeof cell.paths)[number], string>();
  for (const path of cell.paths) {
    if (path.conditions.length === 0) continue;
    const key = [
      ...new Set(
        path.conditions.map(({ sourceCellId, field, operator, value }) =>
          JSON.stringify({ sourceCellId, field, operator, value }),
        ),
      ),
    ]
      .sort()
      .join("|");
    const firstPathId = firstPathByConditions.get(key);
    if (firstPathId) duplicates.set(path, firstPathId);
    else firstPathByConditions.set(key, path.id);
  }
  return duplicates;
}

function structuralBranchIssues(cells: WorkbookCell[]): WorkbookIssue[] {
  const issues: WorkbookIssue[] = [];
  const indexById = new Map(cells.map((cell, index) => [cell.id, index]));
  const reachableIndexes = new Set<number>();
  const pending = cells.length > 0 ? [0] : [];
  let pendingIndex = 0;

  const enqueue = (index: number | undefined) => {
    if (index === undefined || index < 0 || index >= cells.length || reachableIndexes.has(index)) {
      return;
    }
    pending.push(index);
  };

  while (pendingIndex < pending.length) {
    const index = pending[pendingIndex++];
    if (reachableIndexes.has(index)) continue;
    reachableIndexes.add(index);
    const cell = cells[index];

    if (cell.type !== "branch") {
      enqueue(index + 1);
      continue;
    }

    for (const path of cell.paths) {
      if (path.gotoCellId) enqueue(indexById.get(path.gotoCellId));
    }

    const defaultPathResolution = resolveBranchDefaultPath(cell);
    const defaultPath =
      defaultPathResolution.status === "resolved" ? defaultPathResolution.path : undefined;
    const allPathsJumpStrictlyForward =
      defaultPath !== undefined &&
      cell.paths.every((path) => {
        const targetIndex = path.gotoCellId ? indexById.get(path.gotoCellId) : undefined;
        return targetIndex !== undefined && targetIndex > index;
      });
    const canFallThrough = isDeviceScopedBranch(cell) || !allPathsJumpStrictlyForward;
    if (canFallThrough) enqueue(index + 1);
  }

  for (const [index, cell] of cells.entries()) {
    if (cell.type !== "output" && !reachableIndexes.has(index)) {
      issues.push({
        level: "warning",
        code: "unreachable-cell",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
      });
    }

    if (cell.type !== "branch") continue;

    if (resolveBranchDefaultPath(cell).status !== "resolved") {
      issues.push({
        level: "warning",
        code: "branch-no-default",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
      });
    }

    const seenPathIds = new Set<string>();
    const duplicatePathIds = new Set<string>();
    for (const path of cell.paths) {
      if (seenPathIds.has(path.id)) duplicatePathIds.add(path.id);
      seenPathIds.add(path.id);
    }
    for (const pathId of duplicatePathIds) {
      issues.push({
        level: "error",
        code: "duplicate-branch-path-id",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
        ref: pathId,
      });
    }

    if (isGotoBranchCell(cell)) {
      const targetId = cell.paths[0].gotoCellId;
      const targetIndex = targetId ? indexById.get(targetId) : undefined;
      if (targetIndex !== undefined && targetIndex < index) {
        issues.push({
          level: "warning",
          code: "backward-goto-loop",
          cellId: cell.id,
          cellLabel: cellLabelOf(cell),
          ref: targetId,
        });
      }
    }

    const duplicateConditions = duplicateConditionKey(cell);
    for (const [path, firstPathId] of duplicateConditions) {
      let duplicateLabel = path.id;
      if (path.label.trim()) duplicateLabel = path.label.trim();
      issues.push({
        level: "warning",
        code: "path-duplicate-conditions",
        cellId: cell.id,
        cellLabel: cellLabelOf(cell),
        ref: path.id,
        detail: `${duplicateLabel} duplicates ${firstPathId}`,
      });
    }
  }

  return issues;
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
  const locations = walkWorkbookCells(cells, { allowDuplicateIds: true });
  const byId = new Map<string, (typeof locations)[number][]>();
  for (const location of locations) {
    byId.set(location.cell.id, [...(byId.get(location.cell.id) ?? []), location]);
  }
  const families = new Set<SensorFamily>();
  const seenBranchRefs = new Set<string>();
  const seenParallelNames = new Set<string>();

  for (const [cellId, matches] of byId) {
    if (matches.length > 1) {
      issues.push({ level: "error", code: "PARALLEL_CELL_ID_DUPLICATE", cellId });
    }
  }

  for (const location of locations) {
    const { cell } = location;
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
      const hasScopedProtocol = resolveCellScope(cells, location, { allowDuplicateIds: true }).some(
        (candidate) => candidate.cell.type === "protocol",
      );
      if (!hasScopedProtocol) {
        issues.push({
          level: "warning",
          code: "macro-without-input",
          cellId: cell.id,
          cellLabel: cellLabelOf(cell),
        });
      }
    }

    if (cell.type === "branch") {
      const scopeIds = new Set(
        resolveCellScope(cells, location, { allowDuplicateIds: true }).map(
          (candidate) => candidate.cell.id,
        ),
      );
      for (const path of cell.paths) {
        for (const cond of path.conditions) {
          const key = `s:${cell.id}:${cond.sourceCellId}`;
          if (
            cond.sourceCellId &&
            cond.sourceCellId !== DEVICE_CONTEXT_KEY &&
            !seenBranchRefs.has(key)
          ) {
            seenBranchRefs.add(key);
            const sources = byId.get(cond.sourceCellId);
            if (!sources?.length) {
              issues.push({
                level: "error",
                code: "dangling-branch-source",
                cellId: cell.id,
                cellLabel: cellLabelOf(cell),
                ref: cond.sourceCellId,
              });
            } else if (!scopeIds.has(cond.sourceCellId)) {
              const source = sources[0];
              issues.push({
                level: "error",
                code:
                  location.path.length === 0 && source.path.length > 0
                    ? "PARALLEL_REF_INTO_BODY"
                    : "PARALLEL_REF_CROSSES_LANE",
                cellId: cell.id,
                cellLabel: cellLabelOf(cell),
                ref: cond.sourceCellId,
              });
            }
          }
        }
        const gotoKey = `g:${cell.id}:${path.gotoCellId}`;
        if (path.gotoCellId && !seenBranchRefs.has(gotoKey)) {
          seenBranchRefs.add(gotoKey);
          const targets = byId.get(path.gotoCellId);
          if (!targets?.length) {
            issues.push({
              level: "error",
              code: "dangling-branch-goto",
              cellId: cell.id,
              cellLabel: cellLabelOf(cell),
              ref: path.gotoCellId,
            });
          } else if (!targets.some((target) => sameCellPath(target.path, location.path))) {
            const target = targets[0];
            issues.push({
              level: "error",
              code:
                location.path.length === 0 && target.path.length > 0
                  ? "PARALLEL_REF_INTO_BODY"
                  : "CONTAINER_BRANCH_ESCAPES_BODY",
              cellId: cell.id,
              cellLabel: cellLabelOf(cell),
              ref: path.gotoCellId,
            });
          }
        }
      }
    }

    if (cell.type === "parallel") {
      const canonical = sanitizeQuestionLabel(cell.name);
      if (seenParallelNames.has(canonical)) {
        issues.push({
          level: "error",
          code: "PARALLEL_NAME_DUPLICATE",
          cellId: cell.id,
          cellLabel: cell.name,
        });
      }
      seenParallelNames.add(canonical);

      const defaultResolution = resolveParallelDefaultLane(cell);
      if (defaultResolution.kind === "absent") {
        issues.push({
          level: "error",
          code: "PARALLEL_NO_DEFAULT_LANE",
          cellId: cell.id,
          cellLabel: cell.name,
        });
      } else if (defaultResolution.kind === "ambiguous") {
        issues.push({
          level: "error",
          code: "PARALLEL_MULTIPLE_DEFAULT_LANES",
          cellId: cell.id,
          cellLabel: cell.name,
          ref: cell.defaultLaneId,
        });
      }
      const laneIds = new Set<string>();
      for (const lane of cell.lanes) {
        if (laneIds.has(lane.id)) {
          issues.push({
            level: "error",
            code: "PARALLEL_LANE_ID_DUPLICATE",
            cellId: cell.id,
            cellLabel: cell.name,
            ref: lane.id,
          });
        }
        laneIds.add(lane.id);
        if (lane.body.length === 0) {
          issues.push({
            level: "error",
            code: "PARALLEL_LANE_EMPTY",
            cellId: cell.id,
            cellLabel: cell.name,
            ref: lane.id,
          });
        }
        if ((lane.body as WorkbookCell[]).some((nested) => nested.type === "parallel")) {
          issues.push({
            level: "error",
            code: "CONTAINER_NESTING_UNSUPPORTED",
            cellId: cell.id,
            cellLabel: cell.name,
            ref: lane.id,
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

  const bodies = new Map<string, WorkbookCell[]>();
  bodies.set("", cells);
  for (const location of locations) bodies.set(cellPathKey(location.path), location.body);
  for (const body of bodies.values()) issues.push(...structuralBranchIssues(body));

  return { issues, ok: !issues.some((i) => i.level === "error") };
}
