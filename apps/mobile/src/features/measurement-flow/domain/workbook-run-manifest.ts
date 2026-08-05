import { resolveMeasurementDeviceId } from "~/shared/measurements/measurement-device-id";

export type WorkbookRunTerminalStatus = "complete" | "partial" | "failed" | "abandoned" | "unknown";

export type WorkbookRunLaneTerminalStatus = "done" | "partial" | "failed" | "skipped";

export interface WorkbookRunContainerProvenance {
  container_cell_id: string;
  lane_id: string;
  container_attempt_id: string;
}

export interface WorkbookRunExpectedProducer {
  producer_cell_id: string;
  device_ids: string[];
  container_cell_id?: string;
  lane_id?: string;
  container_attempt_id?: string;
}

/** Frozen membership for a lane, including lanes that ultimately produce no rows. */
export interface WorkbookRunExpectedLane extends WorkbookRunContainerProvenance {
  device_ids: string[];
  /** Local-only identity ledger; stripped from the terminal wire record. */
  device_id_by_transport?: Record<string, string>;
}

export type WorkbookRunExpected = WorkbookRunExpectedProducer | WorkbookRunExpectedLane;

export interface WorkbookRunRealizedProducer {
  producer_cell_id: string;
  device_id: string;
  outcome: "ok" | "failed";
  container_cell_id?: string;
  lane_id?: string;
  container_attempt_id?: string;
  /** Local-only logical member key; stripped from the terminal wire record. */
  transport_device_id?: string;
}

/** Terminal lane summary. `abandoned` distinguishes a researcher skip from an unassigned lane. */
export interface WorkbookRunRealizedLane extends WorkbookRunContainerProvenance {
  status: WorkbookRunLaneTerminalStatus;
  abandoned?: true;
}

export type WorkbookRunRealized = WorkbookRunRealizedProducer | WorkbookRunRealizedLane;

export interface WorkbookRunDeviceOutcome extends Partial<WorkbookRunContainerProvenance> {
  producer_cell_id: string;
  transport_device_id: string;
  device_id: string;
  outcome: "ok" | "failed";
}

export interface WorkbookRunLaneDevice {
  transport_device_id: string;
  /** Executor handshake identity, preferred over the transport id when firmware has not replied. */
  handshake_device_id?: string;
  /** Measurement response when available; its firmware `device_id` has highest priority. */
  raw_measurement?: unknown;
}

export interface WorkbookRunLaneAssignment extends WorkbookRunContainerProvenance {
  devices: WorkbookRunLaneDevice[];
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

function isExpectedProducer(entry: WorkbookRunExpected): entry is WorkbookRunExpectedProducer {
  return "producer_cell_id" in entry;
}

function isRealizedProducer(entry: WorkbookRunRealized): entry is WorkbookRunRealizedProducer {
  return "producer_cell_id" in entry;
}

function sameContainerProvenance(
  left: Partial<WorkbookRunContainerProvenance>,
  right: Partial<WorkbookRunContainerProvenance>,
): boolean {
  return (
    left.container_cell_id === right.container_cell_id &&
    left.lane_id === right.lane_id &&
    left.container_attempt_id === right.container_attempt_id
  );
}

export function addExpectedDevice(
  expected: WorkbookRunExpected[],
  producerCellId: string,
  deviceId: string,
  provenance: Partial<WorkbookRunContainerProvenance> = {},
): WorkbookRunExpected[] {
  const existing = expected.find(
    (entry) =>
      isExpectedProducer(entry) &&
      entry.producer_cell_id === producerCellId &&
      sameContainerProvenance(entry, provenance),
  );
  if (!existing) {
    return [
      ...expected,
      { producer_cell_id: producerCellId, device_ids: [deviceId], ...provenance },
    ];
  }
  if (existing.device_ids.includes(deviceId)) return expected;
  return expected.map((entry) =>
    isExpectedProducer(entry) &&
    entry.producer_cell_id === producerCellId &&
    sameContainerProvenance(entry, provenance)
      ? { ...entry, device_ids: [...entry.device_ids, deviceId] }
      : entry,
  );
}

function removeExpectedDevice(
  expected: WorkbookRunExpected[],
  producerCellId: string,
  deviceId: string,
  provenance: Partial<WorkbookRunContainerProvenance> = {},
): WorkbookRunExpected[] {
  return expected.flatMap((entry) => {
    if (
      !isExpectedProducer(entry) ||
      entry.producer_cell_id !== producerCellId ||
      !sameContainerProvenance(entry, provenance)
    ) {
      return [entry];
    }
    const deviceIds = entry.device_ids.filter((id) => id !== deviceId);
    return deviceIds.length > 0 ? [{ ...entry, device_ids: deviceIds }] : [];
  });
}

/**
 * Unit-level PR-2 contract helper. PR-2b's mobile container host wires it to
 * container entry; it is intentionally unreachable in production until then.
 * Reassignment replaces the exact lane membership instead of accumulating it.
 */
export function setExpectedLaneAssignment(
  expected: WorkbookRunExpected[],
  assignment: WorkbookRunLaneAssignment,
): WorkbookRunExpected[] {
  const deviceIdByTransport = Object.fromEntries(
    assignment.devices.map((device) => [
      device.transport_device_id,
      resolveMeasurementDeviceId(
        device.raw_measurement,
        device.handshake_device_id ?? device.transport_device_id,
      ) ?? device.transport_device_id,
    ]),
  );
  const entry: WorkbookRunExpectedLane = {
    container_cell_id: assignment.container_cell_id,
    lane_id: assignment.lane_id,
    container_attempt_id: assignment.container_attempt_id,
    device_ids: [...new Set(Object.values(deviceIdByTransport))],
    device_id_by_transport: deviceIdByTransport,
  };
  const index = expected.findIndex(
    (candidate) => !isExpectedProducer(candidate) && sameContainerProvenance(candidate, entry),
  );
  if (index === -1) return [...expected, entry];
  const next = [...expected];
  next[index] = entry;
  return next;
}

export function addRealizedOutcome(
  realized: WorkbookRunRealized[],
  outcome: WorkbookRunRealizedProducer,
): WorkbookRunRealized[] {
  const index = realized.findIndex(
    (entry) =>
      isRealizedProducer(entry) &&
      entry.producer_cell_id === outcome.producer_cell_id &&
      entry.device_id === outcome.device_id &&
      sameContainerProvenance(entry, outcome),
  );
  if (index === -1) return [...realized, outcome];
  const next = [...realized];
  next[index] = outcome;
  return next;
}

/**
 * Unit-level PR-2 contract helper. PR-2b's mobile container host wires it to
 * terminal lane transitions; it is intentionally unreachable until then.
 */
export function addRealizedLaneStatus(
  realized: WorkbookRunRealized[],
  lane: WorkbookRunRealizedLane,
): WorkbookRunRealized[] {
  const index = realized.findIndex(
    (entry) => !isRealizedProducer(entry) && sameContainerProvenance(entry, lane),
  );
  if (index === -1) return [...realized, lane];
  const next = [...realized];
  next[index] = lane;
  return next;
}

function reconcileExpectedLaneDevice(
  expected: WorkbookRunExpected[],
  outcome: WorkbookRunDeviceOutcome,
  provenance: Partial<WorkbookRunContainerProvenance>,
): WorkbookRunExpected[] {
  if (!outcome.container_cell_id || !outcome.lane_id || !outcome.container_attempt_id) {
    return expected;
  }
  return expected.map((entry) => {
    if (isExpectedProducer(entry) || !sameContainerProvenance(entry, provenance)) return entry;
    const priorDeviceId =
      entry.device_id_by_transport?.[outcome.transport_device_id] ??
      (entry.device_ids.includes(outcome.transport_device_id)
        ? outcome.transport_device_id
        : undefined);
    if (!priorDeviceId || priorDeviceId === outcome.device_id) return entry;
    return {
      ...entry,
      device_ids: [
        ...new Set(
          entry.device_ids.map((deviceId) =>
            deviceId === priorDeviceId ? outcome.device_id : deviceId,
          ),
        ),
      ],
      device_id_by_transport: {
        ...entry.device_id_by_transport,
        [outcome.transport_device_id]: outcome.device_id,
      },
    };
  });
}

/** Replace a retry's earlier fallback id when firmware identity becomes known. */
export function addWorkbookDeviceOutcome(
  expected: WorkbookRunExpected[],
  realized: WorkbookRunRealized[],
  outcome: WorkbookRunDeviceOutcome,
): { expected: WorkbookRunExpected[]; realized: WorkbookRunRealized[] } {
  const provenance: Partial<WorkbookRunContainerProvenance> = {
    ...(outcome.container_cell_id ? { container_cell_id: outcome.container_cell_id } : {}),
    ...(outcome.lane_id ? { lane_id: outcome.lane_id } : {}),
    ...(outcome.container_attempt_id ? { container_attempt_id: outcome.container_attempt_id } : {}),
  };
  const priorIndex = realized.findIndex(
    (entry) =>
      isRealizedProducer(entry) &&
      entry.producer_cell_id === outcome.producer_cell_id &&
      sameContainerProvenance(entry, provenance) &&
      (entry.transport_device_id === outcome.transport_device_id ||
        (entry.transport_device_id === undefined && entry.device_id === outcome.device_id)),
  );
  const prior = priorIndex >= 0 ? realized[priorIndex] : undefined;
  const priorProducer = prior && isRealizedProducer(prior) ? prior : undefined;
  const withoutStaleExpected =
    priorProducer && priorProducer.device_id !== outcome.device_id
      ? removeExpectedDevice(
          expected,
          outcome.producer_cell_id,
          priorProducer.device_id,
          provenance,
        )
      : expected;
  const reconciledLaneExpected = reconcileExpectedLaneDevice(
    withoutStaleExpected,
    outcome,
    provenance,
  );
  const nextExpected = addExpectedDevice(
    reconciledLaneExpected,
    outcome.producer_cell_id,
    outcome.device_id,
    provenance,
  );
  const nextOutcome: WorkbookRunRealizedProducer = { ...outcome };
  if (priorIndex < 0) return { expected: nextExpected, realized: [...realized, nextOutcome] };
  const nextRealized = [...realized];
  nextRealized[priorIndex] = nextOutcome;
  return { expected: nextExpected, realized: nextRealized };
}

export function deriveTerminalStatus(
  expected: WorkbookRunExpected[],
  realized: WorkbookRunRealized[],
): Exclude<WorkbookRunTerminalStatus, "abandoned"> {
  const expectedPairs = expected.flatMap((entry) =>
    isExpectedProducer(entry)
      ? entry.device_ids.map(
          (deviceId) =>
            `${entry.container_attempt_id ?? ""}\u0000${entry.producer_cell_id}\u0000${deviceId}`,
        )
      : [],
  );
  const assignedLanes = expected.filter(
    (entry): entry is WorkbookRunExpectedLane =>
      !isExpectedProducer(entry) && entry.device_ids.length > 0,
  );
  if (expectedPairs.length === 0 && assignedLanes.length === 0) return "unknown";

  const realizedByPair = new Map<string, WorkbookRunRealizedProducer["outcome"]>(
    realized.flatMap((entry) =>
      isRealizedProducer(entry)
        ? [
            [
              `${entry.container_attempt_id ?? ""}\u0000${entry.producer_cell_id}\u0000${entry.device_id}`,
              entry.outcome,
            ] as const,
          ]
        : [],
    ),
  );
  const okCount = expectedPairs.filter((pair) => realizedByPair.get(pair) === "ok").length;
  const laneStatuses = assignedLanes.map((lane) =>
    realized.find(
      (entry): entry is WorkbookRunRealizedLane =>
        !isRealizedProducer(entry) && sameContainerProvenance(entry, lane),
    ),
  );
  const allProducersComplete = okCount === expectedPairs.length;
  const allLanesComplete = laneStatuses.every((lane) => lane?.status === "done");
  if (allProducersComplete && allLanesComplete) return "complete";

  const someLaneSucceeded = laneStatuses.some(
    (lane) => lane?.status === "done" || lane?.status === "partial",
  );
  if (okCount === 0 && !someLaneSucceeded) return "failed";
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
      expected: input.expected.map((entry) => {
        if (isExpectedProducer(entry)) return entry;
        const { device_id_by_transport: _deviceIdByTransport, ...wireEntry } = entry;
        return wireEntry;
      }),
      realized: input.realized.map((entry) => {
        if (!isRealizedProducer(entry)) return entry;
        const { transport_device_id: _transportDeviceId, ...wireEntry } = entry;
        return wireEntry;
      }),
    },
  };
}
