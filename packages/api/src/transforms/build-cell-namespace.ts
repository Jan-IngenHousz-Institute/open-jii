import { namespaceNameOf } from "../domains/workbook/workbook-cells.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import type { DeviceContext } from "./device-context";
import { DEVICE_CONTEXT_KEY } from "./device-context";
import { sanitizeQuestionLabel } from "./label-sanitization";

export interface CellNamespace {
  // Producer output (or `{ answer }` for a question) keyed by stable cell id.
  // Populated for every upstream cell that has produced a value.
  byId: Record<string, unknown>;
  // The same values keyed by canonicalised author-facing name, for `ctx.<name>`
  // access from macro code and for resolving branch sources by name.
  ctx: Record<string, unknown>;
  // Canonical name to cell id, for diagnostics and name-to-id resolution.
  names: Record<string, string>;
}

export interface BuildCellNamespaceOptions {
  /**
   * Scope multi-device outputs to this device: when an output cell carries
   * `deviceResults`, the entry matching this id contributes its data instead
   * of the primary `data`. Values keep the exact single-device shape either
   * way, so macro code never branches on shape.
   */
  deviceId?: string;
  /** Injected as `ctx["$device"]`; reserved, cell names can never produce it. */
  device?: DeviceContext;
}

function unwrapFirst(data: unknown): Record<string, unknown> | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data)) {
    return (data[0] as Record<string, unknown> | undefined) ?? undefined;
  }
  return data as Record<string, unknown>;
}

// Reads a producer cell's output, unwrapping arrays to the first element like
// the macro sandbox's `unwrapMeasurement`. With a deviceId, a multi-device
// output resolves to that device's own result (falling back to primary data).
export function resolveOutputData(
  cells: WorkbookCell[],
  producedBy: string,
  deviceId?: string,
): Record<string, unknown> | undefined {
  const outputCell = cells.find((c) => c.type === "output" && c.producedBy === producedBy);
  if (outputCell?.type !== "output") return undefined;

  if (deviceId !== undefined) {
    const deviceResult = outputCell.deviceResults?.find((r) => r.deviceId === deviceId);
    if (deviceResult?.data != null) return unwrapFirst(deviceResult.data);
  }
  return unwrapFirst(outputCell.data);
}

// The value a cell contributes to the namespace: `{ answer }` for an answered
// question, the unwrapped output for a protocol/macro/command, or undefined for
// other cell types and for producers that have not run yet.
function cellValue(cells: WorkbookCell[], cell: WorkbookCell, deviceId?: string): unknown {
  if (cell.type === "question") {
    return cell.answer != null ? { answer: cell.answer } : undefined;
  }
  if (cell.type === "protocol" || cell.type === "macro" || cell.type === "command") {
    return resolveOutputData(cells, cell.id, deviceId);
  }
  return undefined;
}

// The namespace a macro at `beforeIndex` can read: every upstream output,
// addressable by id (`byId`) and canonical name (`ctx`). Upstream-only, so a
// macro never reads its own or a later cell's output. Duplicate producer names
// are legal in saved workbooks; on collision the nearest upstream wins.
export function buildCellNamespace(
  cells: WorkbookCell[],
  beforeIndex: number = cells.length,
  options?: BuildCellNamespaceOptions,
): CellNamespace {
  const byId: Record<string, unknown> = {};
  const ctx: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  const limit = Math.max(0, Math.min(beforeIndex, cells.length));
  for (let i = 0; i < limit; i++) {
    const cell = cells[i];
    const value = cellValue(cells, cell, options?.deviceId);
    if (value === undefined) continue;

    byId[cell.id] = value;
    const name = namespaceNameOf(cell);
    if (name != null && name !== "") {
      const canonical = sanitizeQuestionLabel(name);
      ctx[canonical] = value;
      names[canonical] = cell.id;
    }
  }

  if (options?.device) {
    ctx[DEVICE_CONTEXT_KEY] = options.device;
  }

  return { ctx, byId, names };
}
