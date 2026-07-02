import type { OutputCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export interface HydrationContext {
  iterationCount: number;
  getAnswer: (cycle: number, cellId: string) => string | undefined;
  scanResult?: unknown;
  /** Entity id of the protocol whose output `scanResult` holds (store.protocolId). */
  protocolId?: string;
}

// Snapshots cells with live values so the shared `evaluateBranch` can read them:
// question `.answer` from the store, and the latest measurement as a synthetic
// output cell. Mobile keeps one scanResult, so only the latest protocol's output
// resolves; others are undefined (false → default path).
export function hydrateCells(cells: WorkbookCell[], ctx: HydrationContext): WorkbookCell[] {
  const { iterationCount, getAnswer, scanResult, protocolId } = ctx;

  const hydrated: WorkbookCell[] = cells.map((cell) =>
    cell.type === "question"
      ? { ...cell, answer: getAnswer(iterationCount, cell.id) ?? cell.answer }
      : { ...cell },
  );

  if (scanResult == null || !protocolId) return hydrated;

  // The scan belongs to the protocol the measurement node ran (store.protocolId);
  // find its cell so the synthetic output is keyed to the right producer.
  const producer = hydrated.find(
    (c) => c.type === "protocol" && c.payload.protocolId === protocolId,
  );
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
