export type WorkbookRunTerminalStatus = "complete" | "partial" | "failed" | "abandoned";

export interface WorkbookRunExpected {
  producer_cell_id: string;
  device_ids: string[];
}

export interface WorkbookRunRealized {
  producer_cell_id: string;
  device_id: string;
  outcome: "ok" | "failed";
}

export interface WorkbookRunCompleteRecord {
  record_kind: "workbook_run_complete";
  workbook_attempt_id: string;
  workbook_version_id?: string;
  terminal_status: WorkbookRunTerminalStatus;
  expected: WorkbookRunExpected[];
  realized: WorkbookRunRealized[];
}

/** Local delivery envelope. Only `record` is published. */
export interface PendingWorkbookRunManifest {
  experimentId: string;
  experimentName: string;
  createdAt: string;
  record: WorkbookRunCompleteRecord;
}

export function addExpectedDevice(
  expected: WorkbookRunExpected[],
  producerCellId: string,
  deviceId: string,
): WorkbookRunExpected[] {
  const existing = expected.find((entry) => entry.producer_cell_id === producerCellId);
  if (!existing) {
    return [...expected, { producer_cell_id: producerCellId, device_ids: [deviceId] }];
  }
  if (existing.device_ids.includes(deviceId)) return expected;
  return expected.map((entry) =>
    entry.producer_cell_id === producerCellId
      ? { ...entry, device_ids: [...entry.device_ids, deviceId] }
      : entry,
  );
}

export function addRealizedOutcome(
  realized: WorkbookRunRealized[],
  outcome: WorkbookRunRealized,
): WorkbookRunRealized[] {
  const index = realized.findIndex(
    (entry) =>
      entry.producer_cell_id === outcome.producer_cell_id && entry.device_id === outcome.device_id,
  );
  if (index === -1) return [...realized, outcome];
  const next = [...realized];
  next[index] = outcome;
  return next;
}

export function deriveTerminalStatus(
  expected: WorkbookRunExpected[],
  realized: WorkbookRunRealized[],
): Exclude<WorkbookRunTerminalStatus, "abandoned"> {
  const expectedPairs = expected.flatMap((entry) =>
    entry.device_ids.map((deviceId) => `${entry.producer_cell_id}\u0000${deviceId}`),
  );
  if (expectedPairs.length === 0) return "complete";

  const realizedByPair = new Map<string, WorkbookRunRealized["outcome"]>(
    realized.map(
      (entry) => [`${entry.producer_cell_id}\u0000${entry.device_id}`, entry.outcome] as const,
    ),
  );
  const okCount = expectedPairs.filter((pair) => realizedByPair.get(pair) === "ok").length;
  if (okCount === expectedPairs.length) return "complete";
  if (okCount === 0) return "failed";
  return "partial";
}

export function buildPendingManifest(input: {
  attemptId?: string;
  workbookVersionId?: string;
  experimentId?: string;
  experimentName?: string;
  expected: WorkbookRunExpected[];
  realized: WorkbookRunRealized[];
  terminalStatus?: WorkbookRunTerminalStatus;
  createdAt?: string;
}): PendingWorkbookRunManifest | undefined {
  if (!input.attemptId || !input.experimentId) return undefined;
  return {
    experimentId: input.experimentId,
    experimentName: input.experimentName ?? "Workbook run",
    createdAt: input.createdAt ?? new Date().toISOString(),
    record: {
      record_kind: "workbook_run_complete",
      workbook_attempt_id: input.attemptId,
      ...(input.workbookVersionId ? { workbook_version_id: input.workbookVersionId } : {}),
      terminal_status: input.terminalStatus ?? deriveTerminalStatus(input.expected, input.realized),
      expected: input.expected,
      realized: input.realized,
    },
  };
}
