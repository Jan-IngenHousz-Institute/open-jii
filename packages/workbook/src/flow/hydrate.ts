import type {
  OutputCell,
  OutputDeviceResult,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";

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
  for (const cell of cells) {
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

  const hydrated: RunnerCell[] = cells.map((cell) => {
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

  // Producers without an output cell in the program get a synthetic one.
  // Appending keeps indices stable; lookups are by producedBy, not position.
  for (const [producedBy, entry] of Object.entries(outputs)) {
    if (entry === undefined || seenProducers.has(producedBy)) continue;
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
}

/** View for the shared @repo/api readers (RunnerCell is the WorkbookCell union). */
export function asWorkbookCells(cells: RunnerCell[]): WorkbookCell[] {
  return cells;
}
