import type {
  OutputCell,
  OutputDeviceResult,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import type { CellPath } from "@repo/api/transforms/workbook-cell-tree";
import {
  cellPathKey,
  findWorkbookCell,
  walkWorkbookCells,
} from "@repo/api/transforms/workbook-cell-tree";

import type { RunnerCell } from "../cells";
import { normalizeOutputData } from "./normalize-output";

export interface OutputEntry {
  /** Verbatim executor/macro response (primary device). Normalization happens at read time. */
  v: unknown;
  /** Per-device results when the producer fanned out over several devices. */
  deviceResults?: OutputDeviceResult[];
  /** Partial-failure and dispatch summaries surfaced on the output cell. */
  messages?: string[];
}

export interface HydrateCellsOptions {
  /**
   * Leave device-producer values raw when the shared API namespace reader is
   * the normalization boundary (macro ctx construction).
   */
  normalizeDeviceOutputs?: boolean;
}

/**
 * Rebuild the cell array with live runtime values folded in, so the shared
 * `evaluateBranch` and `buildCellNamespace` read current state: question
 * `.answer` from the current cycle, producer outputs as (synthetic) output
 * cells. ALL current outputs hydrate, not just the latest scan; outputs carry
 * the normalized first-sample view.
 */
export function hydrateCells(
  cells: RunnerCell[],
  answers: Partial<Record<string, string>>,
  outputs: Partial<Record<string, OutputEntry>>,
  options: HydrateCellsOptions = {},
): RunnerCell[] {
  const seenProducers = new Set<string>();

  // Sample-unwrap applies to device responses only (protocol/command cells and
  // dispatch steps). A macro output legitimately owning a `sample` field must
  // pass through verbatim, matching web's branch behavior today.
  const deviceProducer = new Set<string>();
  for (const { cell } of walkWorkbookCells(cells)) {
    if (cell.type === "protocol" || cell.type === "command") deviceProducer.add(cell.id);
  }
  const view = (producedBy: string, raw: unknown): unknown =>
    options.normalizeDeviceOutputs !== false &&
    (deviceProducer.has(producedBy) || producedBy.endsWith("__dispatch"))
      ? normalizeOutputData(raw)
      : raw;
  const deviceResultsView = (
    producedBy: string,
    entry: OutputEntry,
  ): OutputDeviceResult[] | undefined =>
    entry.deviceResults?.map((r) =>
      r.data === undefined ? r : { ...r, data: view(producedBy, r.data) },
    );

  const pendingByPath = new Map<string, [string, OutputEntry][]>();
  for (const [producedBy, entry] of Object.entries(outputs)) {
    if (entry === undefined) continue;
    const ownerId = producedBy.endsWith("__dispatch")
      ? producedBy.slice(0, -"__dispatch".length)
      : producedBy;
    const owner = findWorkbookCell(cells, ownerId);
    if (!owner) continue;
    const key = cellPathKey(owner.path);
    pendingByPath.set(key, [...(pendingByPath.get(key) ?? []), [producedBy, entry]]);
  }

  const hydrateBody = (body: RunnerCell[], path: CellPath): RunnerCell[] => {
    const hydrated: RunnerCell[] = body.map((cell) => {
      if (cell.type === "parallel") {
        return {
          ...cell,
          lanes: cell.lanes.map((lane) => ({
            ...lane,
            body: hydrateBody(lane.body, [
              ...path,
              { containerCellId: cell.id, laneId: lane.id },
            ]) as typeof lane.body,
          })),
        };
      }
      if (cell.type === "question") {
        const answer = answers[cell.id];
        return answer === undefined ? cell : { ...cell, answer, isAnswered: true };
      }
      if (cell.type === "output") {
        const entry = outputs[cell.producedBy];
        if (entry === undefined) return cell;
        seenProducers.add(cell.producedBy);
        return {
          ...cell,
          data: view(cell.producedBy, entry.v),
          deviceResults: deviceResultsView(cell.producedBy, entry),
        };
      }
      return cell;
    });

    // Producers without an output cell get a synthetic output in their own
    // body. Appending keeps program indices stable and cannot leak to siblings.
    for (const [producedBy, entry] of pendingByPath.get(cellPathKey(path)) ?? []) {
      if (seenProducers.has(producedBy)) continue;
      const synthetic: OutputCell = {
        id: `synthetic-output-${producedBy}`,
        type: "output",
        isCollapsed: false,
        producedBy,
        data: view(producedBy, entry.v),
        deviceResults: deviceResultsView(producedBy, entry),
      };
      hydrated.push(synthetic);
    }
    return hydrated;
  };

  return hydrateBody(cells, []);
}

/** View for the shared @repo/api readers (RunnerCell is the WorkbookCell union). */
export function asWorkbookCells(cells: RunnerCell[]): WorkbookCell[] {
  return cells;
}
