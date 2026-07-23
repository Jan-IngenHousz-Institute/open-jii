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

export function validateBranchCell(cell: BranchCell): string[] {
  const errors: string[] = [];

  if (cell.paths.length === 0) {
    errors.push("Branch has no paths");
    return errors;
  }

  for (const path of cell.paths) {
    const label = path.label || "Unnamed path";

    if (path.conditions.length === 0) {
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

  if (cell.defaultPathId) {
    return cell.paths.find((p) => p.id === cell.defaultPathId);
  }

  return undefined;
}
