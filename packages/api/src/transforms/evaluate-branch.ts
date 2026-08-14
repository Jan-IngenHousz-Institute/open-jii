import type {
  BranchCell,
  BranchCondition,
  BranchPath,
  WorkbookCell,
} from "../domains/workbook/workbook-cells.schema";
import { resolveOutputData } from "./build-cell-namespace";
import type { DeviceContext } from "./device-context";
import { DEVICE_CONTEXT_KEY } from "./device-context";

/**
 * Host-supplied values that only exist at run time. `device` is the connected
 * device a `$device`-sourced condition evaluates against; without it those
 * conditions are false and the branch falls to its default path.
 */
export interface BranchRuntimeContext {
  device?: DeviceContext;
  /** Host connection id used to scope upstream multi-device outputs. */
  deviceId?: string;
}

export type BranchPathResolution<T extends { id: string }> =
  | { status: "resolved"; path: T }
  | { status: "absent" }
  | { status: "ambiguous" };

/** Resolve an id only when it identifies exactly one path. */
export function resolveBranchPathById<T extends { id: string }>(
  paths: readonly T[],
  pathId?: string,
): BranchPathResolution<T> {
  if (!pathId) return { status: "absent" };
  const matches = paths.filter((path) => path.id === pathId);
  if (matches.length === 0) return { status: "absent" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "resolved", path: matches[0] };
}

export function resolveBranchDefaultPath<T extends { id: string }>(cell: {
  paths: readonly T[];
  defaultPathId?: string;
}): BranchPathResolution<T> {
  return resolveBranchPathById(cell.paths, cell.defaultPathId);
}

export function resolveBranchEvaluatedPath<T extends { id: string }>(cell: {
  paths: readonly T[];
  evaluatedPathId?: string;
}): BranchPathResolution<T> {
  return resolveBranchPathById(cell.paths, cell.evaluatedPathId);
}

/** A schema-compatible unconditional jump authored as a one-path branch. */
export function isGotoBranchCell(cell: BranchCell): boolean {
  const defaultPath = resolveBranchDefaultPath(cell);
  return (
    cell.paths.length === 1 &&
    cell.paths[0].conditions.length === 0 &&
    defaultPath.status === "resolved" &&
    defaultPath.path === cell.paths[0]
  );
}

/** True when any condition of the branch reads the reserved `$device` source. */
export function isDeviceScopedBranch(cell: BranchCell): boolean {
  return cell.paths.some((path) =>
    path.conditions.some((cond) => cond.sourceCellId === DEVICE_CONTEXT_KEY),
  );
}

/**
 * A device-scoped branch dispatches devices to measurement cells, so every
 * path (and the default) must point at a protocol or command cell.
 */
export function validateDeviceBranch(cell: BranchCell, cells: WorkbookCell[]): string[] {
  if (!isDeviceScopedBranch(cell)) return [];

  const errors: string[] = [];
  for (const path of cell.paths) {
    const label = path.label || "Unnamed path";
    if (!path.gotoCellId) {
      errors.push(`${label}: device-scoped paths must jump to a protocol or command cell`);
      continue;
    }
    const target = cells.find((c) => c.id === path.gotoCellId);
    if (!target || (target.type !== "protocol" && target.type !== "command")) {
      errors.push(`${label}: jump target must be a protocol or command cell`);
    }
  }
  return errors;
}

/**
 * Validates an authored branch. Runtime callers may preserve the historical
 * conditioned-branch fall-through by disabling the author-only default check;
 * conditionless paths still require one uniquely resolved default either way.
 */
export function validateBranchCell(
  cell: BranchCell,
  options: { requireDefault?: boolean } = {},
): string[] {
  const errors: string[] = [];

  if (cell.paths.length === 0) {
    errors.push("Branch has no paths");
    return errors;
  }

  const pathCounts = new Map<string, number>();
  for (const path of cell.paths) {
    pathCounts.set(path.id, (pathCounts.get(path.id) ?? 0) + 1);
  }
  for (const [pathId, count] of pathCounts) {
    if (count > 1) errors.push(`Branch path id ${pathId} is duplicated`);
  }

  const defaultPathResolution = resolveBranchDefaultPath(cell);
  if (options.requireDefault !== false) {
    if (defaultPathResolution.status === "absent") {
      errors.push("Branch Otherwise path is missing");
    } else if (defaultPathResolution.status === "ambiguous") {
      errors.push("Branch Otherwise path is ambiguous");
    }
  }
  const defaultPath =
    defaultPathResolution.status === "resolved" ? defaultPathResolution.path : undefined;

  if (isGotoBranchCell(cell) && !cell.paths[0].gotoCellId) {
    errors.push("Go to target is missing");
  }

  for (const path of cell.paths) {
    const label = path.label || "Unnamed path";

    if (path.conditions.length === 0 && path !== defaultPath) {
      errors.push(`${label}: no conditions defined`);
      continue;
    }

    for (let i = 0; i < path.conditions.length; i++) {
      const cond = path.conditions[i];
      const prefix = `${label}, condition ${i + 1}`;

      if (!cond.sourceCellId) {
        errors.push(`${prefix}: no source cell selected`);
      }
      if (!cond.field) {
        errors.push(`${prefix}: no field selected`);
      }
      if (!cond.value && cond.value !== "0") {
        errors.push(`${prefix}: no value specified`);
      }
    }
  }

  return errors;
}

export function resolveConditionValue(
  cells: WorkbookCell[],
  sourceCellId: string,
  field: string,
  runtime?: BranchRuntimeContext,
): string | number | undefined {
  if (sourceCellId === DEVICE_CONTEXT_KEY) {
    const device = runtime?.device;
    if (!device) return undefined;
    const val = device[field as keyof DeviceContext];
    if (typeof val === "number" || typeof val === "string") return val;
    return undefined;
  }

  const sourceCell = cells.find((c) => c.id === sourceCellId);
  if (!sourceCell) return undefined;

  if (sourceCell.type === "question") {
    return sourceCell.answer ?? undefined;
  }

  const data = resolveOutputData(cells, sourceCellId, runtime?.deviceId);
  if (data == null) return undefined;

  const val = (data as Record<string, unknown>)[field];
  if (typeof val === "number") return val;
  if (typeof val === "string") return val;
  return val != null ? JSON.stringify(val) : undefined;
}

function evaluateCondition(
  cond: BranchCondition,
  cells: WorkbookCell[],
  runtime?: BranchRuntimeContext,
): boolean {
  const resolved = resolveConditionValue(cells, cond.sourceCellId, cond.field, runtime);
  if (resolved === undefined) return false;

  const left = typeof resolved === "number" ? resolved : Number(resolved);
  const right = Number(cond.value);
  const leftStr = String(resolved);
  const rightStr = cond.value;
  const numeric = !Number.isNaN(left) && !Number.isNaN(right);

  switch (cond.operator) {
    case "eq":
      return numeric ? left === right : leftStr === rightStr;
    case "neq":
      return numeric ? left !== right : leftStr !== rightStr;
    case "gt":
      return numeric ? left > right : leftStr > rightStr;
    case "lt":
      return numeric ? left < right : leftStr < rightStr;
    case "gte":
      return numeric ? left >= right : leftStr >= rightStr;
    case "lte":
      return numeric ? left <= right : leftStr <= rightStr;
  }
}

// AND logic across conditions.
export function evaluatePathConditions(
  path: BranchPath,
  cells: WorkbookCell[],
  runtime?: BranchRuntimeContext,
): boolean {
  if (path.conditions.length === 0) return false;
  return path.conditions.every((cond) => evaluateCondition(cond, cells, runtime));
}

export function evaluateBranch(
  cell: BranchCell,
  cells: WorkbookCell[],
  runtime?: BranchRuntimeContext,
): BranchPath | undefined {
  for (const path of cell.paths) {
    if (evaluatePathConditions(path, cells, runtime)) {
      return path;
    }
  }

  const defaultPath = resolveBranchDefaultPath(cell);
  return defaultPath.status === "resolved" ? defaultPath.path : undefined;
}
