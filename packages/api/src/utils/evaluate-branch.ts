import type {
  BranchCell,
  BranchCondition,
  BranchPath,
  WorkbookCell,
} from "../schemas/workbook-cells.schema";

/**
 * Validate that a branch cell is fully configured.
 * Returns an array of human-readable error strings (empty = valid).
 */
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

/**
 * Resolve a value from a source cell's output. For protocol/macro cells,
 * looks up the output cell produced by that source and reads the field.
 * For question cells, returns the answer string (field is ignored).
 */
export function resolveConditionValue(
  cells: WorkbookCell[],
  sourceCellId: string,
  field: string,
): string | number | undefined {
  const sourceCell = cells.find((c) => c.id === sourceCellId);
  if (!sourceCell) return undefined;

  // Question cells: the "value" is the answer string
  if (sourceCell.type === "question") {
    return sourceCell.answer ?? undefined;
  }

  // Protocol/macro cells: look at the output cell they produced
  const outputCell = cells.find((c) => c.type === "output" && c.producedBy === sourceCellId);
  if (outputCell?.type !== "output" || outputCell.data == null) {
    return undefined;
  }

  const data = outputCell.data as Record<string, unknown>;

  // If data is an array of records, use the first element
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (!first) return undefined;
    const val = first[field];
    if (typeof val === "number") return val;
    if (typeof val === "string") return val;
    return val != null ? JSON.stringify(val) : undefined;
  }

  const val = data[field];
  if (typeof val === "number") return val;
  if (typeof val === "string") return val;
  return val != null ? JSON.stringify(val) : undefined;
}

/**
 * Evaluate a single condition against resolved data.
 */
function evaluateCondition(cond: BranchCondition, cells: WorkbookCell[]): boolean {
  const resolved = resolveConditionValue(cells, cond.sourceCellId, cond.field);
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

/**
 * Evaluate all conditions in a path. Returns true if ALL conditions pass (AND logic).
 */
export function evaluatePathConditions(path: BranchPath, cells: WorkbookCell[]): boolean {
  if (path.conditions.length === 0) return false;
  return path.conditions.every((cond) => evaluateCondition(cond, cells));
}

/**
 * Evaluate a branch cell: find the first path whose conditions all pass.
 * Falls back to `defaultPathId` if no path matches.
 * Returns the matched path or undefined if nothing matched.
 */
export function evaluateBranch(cell: BranchCell, cells: WorkbookCell[]): BranchPath | undefined {
  for (const path of cell.paths) {
    if (evaluatePathConditions(path, cells)) {
      return path;
    }
  }

  // Fall back to default path
  if (cell.defaultPathId) {
    return cell.paths.find((p) => p.id === cell.defaultPathId);
  }

  return undefined;
}
