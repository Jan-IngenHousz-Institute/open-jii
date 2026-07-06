import type { OutputCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import type { RunnerCell } from "../cells";
import { normalizeOutputData } from "./normalize-output";

export interface OutputEntry {
  /** Verbatim executor/macro response. Normalization happens at read time. */
  v: unknown;
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
    deviceProducer.has(producedBy) || producedBy.endsWith("__dispatch")
      ? normalizeOutputData(raw)
      : raw;

  const hydrated: RunnerCell[] = cells.map((cell) => {
    if (cell.type === "question") {
      const answer = answers[cell.id];
      return answer === undefined ? cell : { ...cell, answer, isAnswered: true };
    }
    if (cell.type === "output") {
      const entry = outputs[cell.producedBy];
      if (entry === undefined) return cell;
      seenProducers.add(cell.producedBy);
      return { ...cell, data: view(cell.producedBy, entry.v) };
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
    };
    hydrated.push(synthetic);
  }

  return hydrated;
}

/**
 * View for the shared @repo/api readers. Command cells are structurally alien
 * to the WorkbookCell union but are never read by evaluateBranch or the
 * namespace value resolvers (their values live on output cells), so the cast
 * is safe until zCommandCell lands in @repo/api.
 */
export function asWorkbookCells(cells: RunnerCell[]): WorkbookCell[] {
  return cells as WorkbookCell[];
}
