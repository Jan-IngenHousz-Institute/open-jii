import type { OutputCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export interface HydrationContext {
  iterationCount: number;
  getAnswer: (cycle: number, cellId: string) => string | undefined;
  scanResult?: unknown;
  /** Cell id of the producer (protocol or command) whose output `scanResult` holds. */
  producerCellId?: string;
  /** Macro/analysis outputs keyed by cell id (store.cellOutputs). */
  cellOutputs?: Record<string, unknown>;
}

// Snapshots cells with live values so the shared `evaluateBranch` and macro
// `ctx` can read them: question `.answer` from the store, the latest
// measurement, and macro outputs, each as a synthetic output cell keyed to
// its producer.
export function hydrateCells(cells: WorkbookCell[], ctx: HydrationContext): WorkbookCell[] {
  const { iterationCount, getAnswer, scanResult, producerCellId, cellOutputs } = ctx;

  const hydrated: WorkbookCell[] = cells.map((cell) =>
    cell.type === "question"
      ? { ...cell, answer: getAnswer(iterationCount, cell.id) ?? cell.answer }
      : { ...cell },
  );

  const synthetic: OutputCell[] = [];
  const producedIds = new Set<string>();

  // The scan belongs to the cell that produced it (store.producerCellId, a
  // protocol or command); find it so the synthetic output is keyed to the producer.
  if (scanResult != null && producerCellId) {
    const producer = hydrated.find((c) => c.id === producerCellId);
    if (producer) {
      let data: unknown;
      if (producer.type === "command") {
        // Mirror web's toOutputData so a branch reads the same shape on both hosts:
        // a plain object passes through; any scalar/array is wrapped as { response }.
        data =
          typeof scanResult === "object" && !Array.isArray(scanResult)
            ? scanResult
            : { response: scanResult };
      } else {
        const sample = (scanResult as { sample?: unknown }).sample;
        data = sample != null ? (Array.isArray(sample) ? sample : [sample]) : scanResult;
      }
      synthetic.push({
        id: `synthetic-output-${producer.id}`,
        type: "output",
        isCollapsed: false,
        producedBy: producer.id,
        data,
      });
      producedIds.add(producer.id);
    }
  }

  // Macro/analysis outputs are stored raw (object), matching the web runtime.
  // The live scan wins over a stale stored output for the same producer.
  for (const [cellId, data] of Object.entries(cellOutputs ?? {})) {
    if (producedIds.has(cellId)) continue;
    synthetic.push({
      id: `synthetic-output-${cellId}`,
      type: "output",
      isCollapsed: false,
      producedBy: cellId,
      data,
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
