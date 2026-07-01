import type { OutputCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

export interface HydrationContext {
  iterationCount: number;
  getAnswer: (cycle: number, cellId: string) => string | undefined;
  scanResult?: unknown;
  /** Entity id of the protocol whose output `scanResult` holds (store.protocolId). */
  protocolId?: string;
  /** Macro/analysis outputs keyed by cell id (store.cellOutputs). */
  cellOutputs?: Record<string, unknown>;
}

// Snapshots cells with live values so the shared `evaluateBranch` and macro `ctx`
// can read them: question `.answer` from the store, the latest measurement, and
// macro outputs, each as a synthetic output cell keyed to its producer.
export function hydrateCells(cells: WorkbookCell[], ctx: HydrationContext): WorkbookCell[] {
  const { iterationCount, getAnswer, scanResult, protocolId, cellOutputs } = ctx;

  const hydrated: WorkbookCell[] = cells.map((cell) =>
    cell.type === "question"
      ? { ...cell, answer: getAnswer(iterationCount, cell.id) ?? cell.answer }
      : { ...cell },
  );

  const synthetic: OutputCell[] = [];
  const producedIds = new Set<string>();

  // Macro/analysis outputs are stored raw (object), matching the web runtime.
  for (const [cellId, data] of Object.entries(cellOutputs ?? {})) {
    synthetic.push({
      id: `synthetic-output-${cellId}`,
      type: "output",
      isCollapsed: false,
      producedBy: cellId,
      data,
    });
    producedIds.add(cellId);
  }

  // The scan belongs to the protocol the measurement node ran (store.protocolId);
  // key the synthetic output to that producer. Sample is array-wrapped to match
  // how protocol output is unwrapped downstream.
  if (scanResult != null && protocolId) {
    const producer = hydrated.find(
      (c) => c.type === "protocol" && c.payload.protocolId === protocolId,
    );
    if (producer) {
      const sample = (scanResult as { sample?: unknown }).sample;
      const data = sample != null ? (Array.isArray(sample) ? sample : [sample]) : scanResult;
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

  if (synthetic.length === 0) return hydrated;

  // Drop any stale output for these producers, then append the live ones.
  return [
    ...hydrated.filter((c) => !(c.type === "output" && producedIds.has(c.producedBy))),
    ...synthetic,
  ];
}
