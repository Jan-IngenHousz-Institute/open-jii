import type { OutputCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { RuntimeCellOutput } from "@repo/api/transforms/runtime-output";

export interface HydrationContext {
  iterationCount: number;
  getAnswer: (cycle: number, cellId: string) => string | undefined;
  /** Sole resolver-authoritative output registry for the active cycle. */
  outputsByCellId: Record<string, RuntimeCellOutput>;
}

// Snapshots cells with live values so the shared `evaluateBranch` and macro
// `ctx` can read them: question `.answer` from the store and strict runtime
// envelopes converted to synthetic output cells keyed to their producers.
export function hydrateCells(cells: WorkbookCell[], ctx: HydrationContext): WorkbookCell[] {
  const { iterationCount, getAnswer, outputsByCellId } = ctx;

  const hydrated: WorkbookCell[] = cells.map((cell) =>
    cell.type === "question"
      ? { ...cell, answer: getAnswer(iterationCount, cell.id) ?? cell.answer }
      : { ...cell },
  );

  const synthetic: OutputCell[] = [];
  const producedIds = new Set<string>();
  for (const [cellId, output] of Object.entries(outputsByCellId)) {
    const deviceResults =
      output.scope === "device"
        ? output.deviceResults.map(({ deviceId, deviceLabel, data, error }) => ({
            deviceId,
            deviceLabel,
            data,
            error,
          }))
        : undefined;
    synthetic.push({
      id: `synthetic-output-${cellId}`,
      type: "output",
      isCollapsed: false,
      producedBy: cellId,
      // Legacy shared branch/macro consumers read top-level data. Device
      // resolution itself remains exact via deviceResults.
      data: output.scope === "shared" ? output.data : output.deviceResults[0]?.data,
      deviceResults,
    });
    producedIds.add(cellId);
  }

  if (synthetic.length === 0) return hydrated;

  // Drop any stale output for these producers, then append the live ones.
  return [
    ...hydrated.filter((c) => !(c.type === "output" && producedIds.has(c.producedBy))),
    ...synthetic,
  ];
}
