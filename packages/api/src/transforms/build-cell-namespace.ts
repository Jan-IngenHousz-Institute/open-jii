import { namespaceNameOf } from "../domains/workbook/workbook-cells.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import type { DeviceContext } from "./device-context";
import { DEVICE_CONTEXT_KEY } from "./device-context";
import { sanitizeQuestionLabel } from "./label-sanitization";
import type { MacroInputErrorCode, MacroInputSource } from "./normalize-macro-input";
import { normalizeMacroInput } from "./normalize-macro-input";
import type { CellAddress, CellLocation, CellPath } from "./workbook-cell-tree";
import { findWorkbookCell, findWorkbookCellInBody, resolveCellScope } from "./workbook-cell-tree";

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
  /** Tree-aware consumer. When present, `beforeIndex` is ignored. */
  consumer?: CellAddress;
}

export class OutputDataNormalizationError extends Error {
  constructor(
    public readonly code: MacroInputErrorCode,
    public readonly source: Exclude<MacroInputSource, "direct">,
  ) {
    super(`Output data normalization failed: ${code}`);
    this.name = "OutputDataNormalizationError";
  }
}

export function isOutputDataNormalizationError(
  error: unknown,
): error is OutputDataNormalizationError {
  return error instanceof Error && error.name === "OutputDataNormalizationError" && "code" in error;
}

function normalizeOutputData(data: unknown): unknown {
  const normalized = normalizeMacroInput(data);
  if (!normalized.ok) {
    throw new OutputDataNormalizationError(normalized.error, normalized.source);
  }
  return normalized.value;
}

// Reads a producer cell's raw output through the shared macro-input projection.
// With a deviceId, a multi-device output resolves to that device's own result
// (falling back to primary data). The stored output cell is never mutated.
export function resolveOutputData(
  cells: WorkbookCell[],
  producedBy: string,
  deviceId?: string,
  producerPath?: CellPath,
): unknown {
  const producer = producerPath
    ? findWorkbookCellInBody(cells, { path: producerPath, cellId: producedBy })
    : findWorkbookCell(cells, producedBy);
  const outputCell = producer?.body.find(
    (cell) => cell.type === "output" && cell.producedBy === producedBy,
  );
  if (outputCell?.type !== "output") return undefined;

  if (deviceId !== undefined) {
    const deviceResult = outputCell.deviceResults?.find((r) => r.deviceId === deviceId);
    if (deviceResult?.data !== undefined) return normalizeOutputData(deviceResult.data);
  }
  return normalizeOutputData(outputCell.data);
}

// The value a cell contributes to the namespace: `{ answer }` for an answered
// question, the projected output for a protocol/macro/command, or undefined for
// other cell types and for producers that have not run yet.
function cellValue(cells: WorkbookCell[], location: CellLocation, deviceId?: string): unknown {
  const { cell } = location;
  if (cell.type === "question") {
    return cell.answer != null ? { answer: cell.answer } : undefined;
  }
  if (
    cell.type === "protocol" ||
    cell.type === "macro" ||
    cell.type === "command" ||
    cell.type === "parallel"
  ) {
    return resolveOutputData(cells, cell.id, deviceId, location.path);
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
  const parallel: Record<string, unknown> = {};

  const scope: CellLocation[] = options?.consumer
    ? resolveCellScope(cells, options.consumer)
    : cells
        .slice(0, Math.max(0, Math.min(beforeIndex, cells.length)))
        .map((cell, index) => ({ cell, cellId: cell.id, index, body: cells, path: [] }));
  for (const location of scope) {
    const { cell } = location;
    const value = cellValue(cells, location, options?.deviceId);
    if (value === undefined) continue;

    byId[cell.id] = value;
    const name = namespaceNameOf(cell);
    if (name != null && name !== "") {
      const canonical = sanitizeQuestionLabel(name);
      ctx[canonical] = value;
      names[canonical] = cell.id;
      if (cell.type === "parallel") parallel[canonical] = value;
    }
  }

  if (options?.device) {
    ctx[DEVICE_CONTEXT_KEY] = options.device;
  }
  if (Object.keys(parallel).length > 0) {
    ctx.$parallel = parallel;
  }

  return { ctx, byId, names };
}
