import type { OutputCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

export interface HydrationContext {
  iterationCount: number;
  getAnswer: (cycle: number, cellId: string) => string | undefined;
  scanResult?: unknown;
  /** Cell id of the producer (library or inline command) whose output `scanResult` holds. */
  producerCellId?: string;
}

// Snapshots cells with live values so the shared `evaluateBranch` can read them:
// question `.answer` from the store, and the latest measurement as a synthetic
// output cell. Mobile keeps one scanResult, so only the latest producer's output
// resolves; others are undefined (false → default path).
export function hydrateCells(cells: WorkbookCell[], ctx: HydrationContext): WorkbookCell[] {
  const { iterationCount, getAnswer, scanResult, producerCellId } = ctx;

  const hydrated: WorkbookCell[] = cells.map((cell) =>
    cell.type === "question"
      ? { ...cell, answer: getAnswer(iterationCount, cell.id) ?? cell.answer }
      : { ...cell },
  );

  if (scanResult == null || !producerCellId) return hydrated;

  // The scan belongs to the cell that produced it (store.producerCellId, a
  // library or inline command); find it so the synthetic output is keyed to the producer.
  const producer = hydrated.find((c) => c.id === producerCellId);
  if (!producer) return hydrated;

  const sample = (scanResult as { sample?: unknown }).sample;
  const data = sample != null ? (Array.isArray(sample) ? sample : [sample]) : scanResult;

  const outputCell: OutputCell = {
    id: `synthetic-output-${producer.id}`,
    type: "output",
    isCollapsed: false,
    producedBy: producer.id,
    data,
  };

  // Drop any stale output for this producer, then append the live one.
  return [
    ...hydrated.filter((c) => !(c.type === "output" && c.producedBy === producer.id)),
    outputCell,
  ];
}
