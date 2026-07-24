"use client";

import { useMutation } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { env } from "~/env";
import type {
  IotDeviceConnection,
  WorkbookConnectionType,
} from "~/hooks/iot/useIotConnections/useIotConnections";
import { useIotConnections } from "~/hooks/iot/useIotConnections/useIotConnections";
import {
  executeCommandWithDriver,
  executeProtocolWithDriver,
} from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
import { orpc, orpcClient } from "~/lib/orpc";
import { getLiveProtocolCode } from "~/lib/protocol-code-registry";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { isReferencedCommandPayload } from "@repo/api/domains/workbook/command-source.schema";
import type {
  BranchCell,
  CommandCell,
  MacroCell,
  OutputCell,
  OutputDeviceResult,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { buildCellNamespace } from "@repo/api/transforms/build-cell-namespace";
import { resolveCommandPayload, resolveInlineCommand } from "@repo/api/transforms/command-payload";
import type {
  CommandResolutionFailure,
  CommandResolutionFailureCode,
} from "@repo/api/transforms/command-resolution";
import { toDeviceContext } from "@repo/api/transforms/device-context";
import { presentDevice } from "@repo/api/transforms/device-presentation";
import {
  evaluateBranch,
  isDeviceScopedBranch,
  validateBranchCell,
  validateDeviceBranch,
} from "@repo/api/transforms/evaluate-branch";
import type { OutputProvenance, RuntimeCellOutput } from "@repo/api/transforms/runtime-output";
import {
  hasMatchingProvenance,
  runtimeOutputFromQuestionAnswer,
} from "@repo/api/transforms/runtime-output";

type CellExecutionStatus = "idle" | "running" | "completed" | "error";

interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  // Jupyter-style: each run appends the global counter value.
  executionOrder?: number[];
}

interface UseWorkbookExecutionOptions {
  cells: WorkbookCell[];
  /**
   * Commit an execution-owned change. The hook passes a pure transform applied
   * to the host's LATEST cells (never a stale snapshot), so concurrent
   * completions and non-invalidating edits compose deterministically.
   */
  onCellsChange: (update: (latest: WorkbookCell[]) => WorkbookCell[]) => void;
  onPromptQuestion?: (cell: QuestionCell) => Promise<string | undefined>;
  /**
   * Stable design/version key for the workbook under execution. The draft
   * editor has no published version, so the workbook id is the stable design
   * key that scopes provenance; the execution epoch (regenerated on every
   * invalidation) carries session/design-change freshness on top of it.
   */
  workbookId: string;
}

/** Runtime-only resolved value / failure per target device for one command cell. */
export interface CommandResolvedPreview {
  perDevice: {
    deviceId: string;
    deviceLabel?: string;
    resolved?: string;
    errorCode?: CommandResolutionFailureCode;
  }[];
}

// Generic, data-free messages for a resolution failure. Never interpolates the
// resolved string or source data (those stay out of logs and output text).
const RESOLUTION_FAILURE_MESSAGES: Record<CommandResolutionFailureCode, string> = {
  STATIC_COMMAND_INVALID: "The command content is invalid",
  COMMAND_SOURCE_MISSING: "The referenced source cell is missing",
  COMMAND_SOURCE_INELIGIBLE: "The referenced source cell cannot produce a command",
  COMMAND_SOURCE_NOT_EARLIER: "The referenced source must run before this command",
  COMMAND_FIELD_EMPTY: "The referenced field is empty",
  COMMAND_OUTPUT_MISSING: "The referenced source has not produced a result yet",
  COMMAND_OUTPUT_DUPLICATE: "The referenced source has conflicting outputs",
  COMMAND_OUTPUT_INVALID: "The referenced source output is not usable",
  COMMAND_SOURCE_STALE: "The referenced source result is stale; run it again",
  DEVICE_OUTPUT_MISSING: "This device has no result from the referenced source",
  DEVICE_OUTPUT_DUPLICATE: "The referenced source has duplicate device results",
  SOURCE_DEVICE_FAILED: "The referenced source failed on this device",
  COMMAND_FIELD_MISSING: "The referenced field is missing from the source output",
  COMMAND_VALUE_NOT_STRING: "The referenced field is not a text value",
  COMMAND_VALUE_EMPTY: "The referenced field is empty",
};

// Authored structure that must invalidate runtime freshness when it changes.
// Outputs and per-run fields (answers, branch evaluation, collapse) are excluded
// so execution's own writes never invalidate. Exported so the editor host can
// compare it synchronously in its authored onCellsChange (before setCells).
export function workbookDesignSignature(cells: WorkbookCell[]): string {
  const authored = cells
    .filter((c) => c.type !== "output")
    .map((c) => {
      switch (c.type) {
        case "question": {
          const { answer: _a, isAnswered: _b, isCollapsed: _c, ...rest } = c;
          return rest;
        }
        case "branch": {
          const { evaluatedPathId: _e, isCollapsed: _c, ...rest } = c;
          return rest;
        }
        default: {
          const { isCollapsed: _c, ...rest } = c;
          return rest;
        }
      }
    });
  return JSON.stringify(authored);
}

/** Immutable identity of one execution run, captured at its synchronous start. */
export interface RunToken {
  generation: number;
  provenance: OutputProvenance;
}

/**
 * Per-run state threaded through every nested dispatch. `consumed` is run-LOCAL
 * (a fresh Set per manual run / Run all), so a device branch's "already ran
 * this target" bookkeeping cannot be cleared or observed by a concurrent run.
 */
export interface RunContext {
  token: RunToken;
  consumed: Set<string>;
}

function outputsByProducer(cells: WorkbookCell[]): Map<string, OutputCell> {
  const map = new Map<string, OutputCell>();
  for (const cell of cells) if (cell.type === "output") map.set(cell.producedBy, cell);
  return map;
}

// Remove any output owned by `producedBy`, then (if `output`) insert it right
// after that producer. Exactly-once upsert by ownership; never duplicates.
function upsertOutput(
  cells: WorkbookCell[],
  producedBy: string,
  output: OutputCell | undefined,
): WorkbookCell[] {
  const withoutOwned = cells.filter((c) => !(c.type === "output" && c.producedBy === producedBy));
  if (!output) return withoutOwned;
  const idx = withoutOwned.findIndex((c) => c.id === producedBy);
  if (idx < 0) return withoutOwned;
  const result = [...withoutOwned];
  result.splice(idx + 1, 0, output);
  return result;
}

// Runtime fields a completion may legitimately change on its executed cell.
function runtimeFieldDelta(
  before: WorkbookCell,
  after: WorkbookCell,
): Partial<Pick<QuestionCell, "answer" | "isAnswered">> &
  Partial<Pick<BranchCell, "evaluatedPathId">> {
  const delta: Record<string, unknown> = {};
  if (after.type === "question" && before.type === "question") {
    if (after.answer !== before.answer) delta.answer = after.answer;
    if (after.isAnswered !== before.isAnswered) delta.isAnswered = after.isAnswered;
  }
  if (after.type === "branch" && before.type === "branch") {
    if (after.evaluatedPathId !== before.evaluatedPathId)
      delta.evaluatedPathId = after.evaluatedPathId;
  }
  return delta;
}

/**
 * Apply ONE completion's field-scoped delta (`before` -> `after`, the run's own
 * input/output pair) onto the LATEST host state. Only the producers whose owned
 * output changed are upserted/removed (by id, once), and only the executed
 * cell's runtime fields (question `answer`/`isAnswered`, branch `evaluatedPathId`)
 * are patched. Every unrelated cell in `latest` is preserved verbatim: other
 * producers' outputs, other answers/branch evaluations, order, membership, and
 * `isCollapsed` (authored AND output cells). A stale snapshot therefore cannot
 * drop a concurrent completion or resurrect an invalidated authored edit.
 */
export function applyExecutionDelta(
  latest: WorkbookCell[],
  before: WorkbookCell[],
  after: WorkbookCell[],
): WorkbookCell[] {
  let result = latest;

  const beforeOutputs = outputsByProducer(before);
  const afterOutputs = outputsByProducer(after);
  for (const producedBy of beforeOutputs.keys()) {
    if (!afterOutputs.has(producedBy)) result = upsertOutput(result, producedBy, undefined);
  }
  for (const [producedBy, output] of afterOutputs) {
    if (beforeOutputs.get(producedBy) === output) continue;
    // Collapse is host-owned across a result refresh: carry the latest owned
    // output's `isCollapsed` onto its replacement so a rerun that lands while
    // the user has the prior result collapsed does not spring it back open.
    const prior = result.find((c) => c.type === "output" && c.producedBy === producedBy);
    const merged =
      prior && prior.isCollapsed !== output.isCollapsed
        ? { ...output, isCollapsed: prior.isCollapsed }
        : output;
    result = upsertOutput(result, producedBy, merged);
  }

  const beforeById = new Map(before.map((c) => [c.id, c]));
  for (const afterCell of after) {
    if (afterCell.type === "output") continue;
    const beforeCell = beforeById.get(afterCell.id);
    if (!beforeCell) continue;
    const delta = runtimeFieldDelta(beforeCell, afterCell);
    if (Object.keys(delta).length === 0) continue;
    result = result.map((c) =>
      c.id === afterCell.id && c.type !== "output" ? { ...c, ...delta } : c,
    );
  }

  return result;
}

// Safe telemetry payload: stable code + ids + provenance only. Never the
// resolved string, source data, or device error (see technical plan section 9).
function resolutionFailurePayload(
  error: CommandResolutionFailure,
  provenance: OutputProvenance,
): Record<string, string | undefined> {
  return {
    code: error.code,
    commandCellId: error.commandCellId,
    sourceCellId: error.sourceCellId,
    field: error.field,
    targetDeviceId: error.targetDeviceId,
    workbookVersionId: provenance.workbookVersionId,
    executionEpoch: provenance.executionEpoch,
  };
}

function resolveSensorFamily(_cells: WorkbookCell[]): SensorFamily {
  return "multispeq";
}

async function getProtocolCode(cell: ProtocolCell): Promise<Record<string, unknown>[] | null> {
  // Prefer the live editor code so the device runs exactly what is on screen,
  // with no redundant backend round-trip. Fall back to the last saved version
  // only when no editor is mounted for this protocol (or it holds invalid code).
  const live = getLiveProtocolCode(cell.payload.protocolId);
  if (live && live.length > 0) return live;

  try {
    const result = await orpcClient.protocols.getProtocol({ id: cell.payload.protocolId });
    const code = result.code;
    if (code.length > 0) {
      return code;
    }
    return null;
  } catch {
    return null;
  }
}

function findPrecedingOutput(cells: WorkbookCell[], beforeIndex: number): OutputCell | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.type === "output" && (c.data != null || (c.deviceResults?.length ?? 0) > 0)) {
      return c;
    }
  }
  return null;
}

// Replaces any previous output produced by the same source cell.
function insertOutputAfterCell(
  currentCells: WorkbookCell[],
  sourceCellId: string,
  outputCell: OutputCell,
): WorkbookCell[] {
  const filtered = currentCells.filter(
    (c) => !(c.type === "output" && c.producedBy === sourceCellId),
  );
  const idx = filtered.findIndex((c) => c.id === sourceCellId);
  const updated = [...filtered];
  updated.splice(idx + 1, 0, outputCell);
  return updated;
}

function makeOutputCell(
  producedBy: string,
  data: Record<string, unknown> | undefined,
  executionTime: number,
  messages: string[],
): OutputCell {
  return {
    id: crypto.randomUUID(),
    type: "output",
    isCollapsed: false,
    producedBy,
    data,
    executionTime,
    messages,
  };
}

function makeErrorOutputCell(producedBy: string, error: string, executionTime = 0): OutputCell {
  return makeOutputCell(producedBy, undefined, executionTime, [error]);
}

function secondaryDeviceLabel(device: IotDeviceConnection): string {
  return (
    device.identity.deviceId ??
    (device.ordinal != null ? `Device #${device.ordinal}` : device.label)
  );
}

function resultDisplayLabel(result: OutputDeviceResult): string {
  const presentation = presentDevice({ name: result.deviceName, family: result.family });
  const primary =
    presentation.provenance === "fallback"
      ? (result.deviceLabel ?? result.deviceId)
      : presentation.primary;
  const secondary = [
    presentation.provenance === "name" ? presentation.productName : null,
    result.deviceLabel,
  ]
    .filter((value): value is string => value != null && value !== primary)
    .filter((value, index, values) => values.indexOf(value) === index);
  return [primary, ...secondary].join(" · ");
}

// Normalises any non-object device response into the output cell's data shape.
function toOutputData(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { response: data };
}

export function useWorkbookExecution({
  cells,
  onCellsChange,
  onPromptQuestion,
  workbookId,
}: UseWorkbookExecutionOptions) {
  const posthog = usePostHog();
  const [executionStates, setExecutionStates] = useState<Record<string, CellExecutionState>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [sensorFamily, setSensorFamilyState] = useState<SensorFamily>(() =>
    resolveSensorFamily(cells),
  );
  const [connectionType, setConnectionType] = useState<WorkbookConnectionType>("serial");
  const abortRef = useRef(false);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCellsChangeRef = useRef(onCellsChange);
  onCellsChangeRef.current = onCellsChange;
  const onPromptQuestionRef = useRef(onPromptQuestion);
  onPromptQuestionRef.current = onPromptQuestion;

  const setSensorFamily = useCallback((family: SensorFamily) => {
    setSensorFamilyState(family);
  }, []);

  const { connections, isConnecting, connect, disconnectDevice, disconnectAll } =
    useIotConnections(sensorFamily);
  const isConnected = connections.length > 0;

  const executeMacroMutation = useMutation(orpc.macros.executeMacro.mutationOptions());

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const executeMacroMutationRef = useRef(executeMacroMutation);
  executeMacroMutationRef.current = executeMacroMutation;

  const setCellState = useCallback(
    (cellId: string, state: Omit<CellExecutionState, "executionOrder">) => {
      setExecutionStates((prev) => {
        const existing = prev[cellId] as CellExecutionState | undefined;
        return { ...prev, [cellId]: { ...state, executionOrder: existing?.executionOrder } };
      });
    },
    [],
  );

  const execCounterRef = useRef(0);

  // Synchronous provenance-scoped producer registry, kept in a ref (not React
  // state) so one execution step can feed the next in the same async pass with
  // no render/timing race. Output-cell presence is display only; this map is
  // the sole freshness source.
  const runtimeOutputsRef = useRef<Map<string, RuntimeCellOutput>>(new Map());
  // Active web execution epoch; regenerated on every invalidation. Combined
  // with the workbook design key it forms the OutputProvenance every completing
  // producer is recorded under and every resolution is checked against.
  const executionEpochRef = useRef<string>(crypto.randomUUID());
  // The COMMITTED workbook/design key. Updated in a layout-phase boundary (not
  // during render), so a speculative/aborted concurrent render cannot expose an
  // uncommitted key to event handlers still bound to the committed UI; token
  // capture and provenance always read the committed value.
  const workbookIdRef = useRef(workbookId);

  // Monotonic generation, bumped on every invalidation.
  const generationRef = useRef(0);

  const [commandPreviews, setCommandPreviews] = useState<Record<string, CommandResolvedPreview>>(
    {},
  );

  const currentProvenance = useCallback(
    (): OutputProvenance => ({
      workbookVersionId: workbookIdRef.current,
      executionEpoch: executionEpochRef.current,
    }),
    [],
  );

  // A run captures this token at its start and threads it everywhere. Active
  // only while generation is unchanged AND captured provenance equals current,
  // so a workbook-key change during render makes an in-flight producer inert
  // before the passive effect. Commits stamp the captured provenance.
  const isActive = useCallback(
    (token: RunToken) =>
      token.generation === generationRef.current &&
      hasMatchingProvenance(token.provenance, currentProvenance()),
    [currentProvenance],
  );
  const captureToken = useCallback(
    (): RunToken => ({ generation: generationRef.current, provenance: currentProvenance() }),
    [currentProvenance],
  );

  const getRuntimeCellOutput = useCallback(
    (sourceCellId: string): RuntimeCellOutput | undefined =>
      runtimeOutputsRef.current.get(sourceCellId),
    [],
  );

  const recordRuntimeOutput = useCallback((cellId: string, output: RuntimeCellOutput) => {
    runtimeOutputsRef.current.set(cellId, output);
  }, []);

  // Synchronous full reset for every non-Run-all invalidation: bump generation
  // (in-flight completions go inert), new epoch, empty registry, cleared
  // previews + execution states + running flag + counter. Run all calls this
  // first, then sets its own fresh running state.
  const invalidateRuntime = useCallback(() => {
    generationRef.current += 1;
    executionEpochRef.current = crypto.randomUUID();
    runtimeOutputsRef.current = new Map();
    execCounterRef.current = 0;
    setCommandPreviews({});
    setExecutionStates({});
    setIsRunningAll(false);
  }, []);

  // Route allowlisted resolver-failure metadata through the durable client
  // telemetry (PostHog). Console stays development-only. Never resolved/source/
  // device-error data.
  const reportResolutionFailure = useCallback(
    (error: CommandResolutionFailure, provenance: OutputProvenance) => {
      const payload = resolutionFailurePayload(error, provenance);
      posthog.capture("dynamic_command_resolution_failed", payload);
      if (env.NODE_ENV !== "production") {
        console.warn("[workbook] dynamic command resolution failed", payload);
      }
    },
    [posthog],
  );

  const designSigRef = useRef<string | null>(null);
  const designKeyRef = useRef(workbookId);

  // ATOMIC committed-key transition in the layout phase: on a key change,
  // invalidate the runtime AND publish the new key + backstop refs in one
  // synchronous callback (no yield), so a later handler sees a consistent
  // {new key, new epoch, new generation, empty registry}.
  useLayoutEffect(() => {
    if (designKeyRef.current === workbookId) return;
    invalidateRuntime();
    workbookIdRef.current = workbookId;
    designKeyRef.current = workbookId;
    designSigRef.current = workbookDesignSignature(cellsRef.current);
  }, [workbookId, invalidateRuntime]);

  // Passive backstop ONLY for an externally-replaced authored design (parent
  // swaps `cells` without going through the editor's synchronous invalidator).
  // The workbook-key transition is owned by the layout effect above.
  useEffect(() => {
    const sig = workbookDesignSignature(cells);
    if (designSigRef.current === null) {
      designSigRef.current = sig;
      return;
    }
    if (sig !== designSigRef.current) {
      designSigRef.current = sig;
      invalidateRuntime();
    }
  }, [cells, invalidateRuntime]);

  // Collapse per-device settled outcomes into one output cell. A single
  // device keeps the exact legacy output shape; several devices additionally
  // carry per-device results, with failures listed as messages. `deviceResults`
  // carries device identity (family/deviceName) for single- and multi-device runs.
  const finishDeviceFanOut = useCallback(
    (
      cellId: string,
      devices: IotDeviceConnection[],
      settled: PromiseSettledResult<unknown>[],
      executionTime: number,
      currentCells: WorkbookCell[],
      fallbackMessage: string,
      normalize: (data: unknown) => Record<string, unknown>,
      token: RunToken,
    ): WorkbookCell[] => {
      const results: {
        deviceId: string;
        deviceLabel: string;
        family: SensorFamily;
        deviceName?: string;
        data?: Record<string, unknown>;
        error?: string;
      }[] = devices.map((d, i) => {
        const outcome = settled[i];
        const identity = { family: d.family, deviceName: d.identity.name };
        const deviceLabel = secondaryDeviceLabel(d);
        return outcome.status === "fulfilled"
          ? { deviceId: d.id, deviceLabel, ...identity, data: normalize(outcome.value) }
          : {
              deviceId: d.id,
              deviceLabel,
              ...identity,
              error:
                outcome.reason instanceof Error
                  ? outcome.reason.message
                  : String(outcome.reason ?? fallbackMessage),
            };
      });
      // Record the producer's own device replies (protocol/command) so a later
      // dynamic command can reference them. Device scope even for one device;
      // display-only metadata (family/deviceName/executionTime) is dropped.
      recordRuntimeOutput(cellId, {
        scope: "device",
        provenance: token.provenance,
        deviceResults: results.map((r) =>
          r.error !== undefined
            ? { deviceId: r.deviceId, deviceLabel: r.deviceLabel, error: r.error }
            : { deviceId: r.deviceId, deviceLabel: r.deviceLabel, data: r.data },
        ),
      });

      const successes = results.filter((r) => r.error === undefined);
      const failures = results.filter((r) => r.error !== undefined);
      const isMulti = devices.length > 1;
      const messages = isMulti ? failures.map((f) => `${resultDisplayLabel(f)}: ${f.error}`) : [];

      if (successes.length === 0) {
        const message = failures[0]?.error ?? fallbackMessage;
        setCellState(cellId, { status: "error", error: message });
        const errorOutput = {
          ...(isMulti
            ? makeOutputCell(cellId, undefined, executionTime, messages)
            : makeErrorOutputCell(cellId, message, executionTime)),
          deviceResults: results,
        };
        return insertOutputAfterCell(currentCells, cellId, errorOutput);
      }

      // Partial failure stays "completed": the successful devices' data is
      // usable and the failed ones are called out in the output messages.
      setCellState(cellId, { status: "completed" });
      const output = makeOutputCell(cellId, successes[0].data, executionTime, messages);
      return insertOutputAfterCell(currentCells, cellId, { ...output, deviceResults: results });
    },
    [setCellState, recordRuntimeOutput],
  );

  const runProtocolCell = useCallback(
    async (
      cell: ProtocolCell,
      currentCells: WorkbookCell[],
      token: RunToken,
      deviceSubset?: IotDeviceConnection[],
    ) => {
      const protocolCode = await getProtocolCode(cell);
      if (!isActive(token)) return currentCells;
      if (!protocolCode) {
        setCellState(cell.id, { status: "error", error: "Invalid or missing protocol code" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "Invalid or missing protocol JSON"),
        );
      }

      if (connectionsRef.current.length === 0) {
        // The page-level Run handler short-circuits to connect() before this
        // path on direct Run clicks; this branch covers Run all + scripted
        // entry points where we still need a recorded error.
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "No device connected - connect a device to run this protocol",
          ),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      // Multi-device fan-out (see mobile Multi-scan): one protocol, every
      // connected device in parallel, per-device outcomes.
      const devices = deviceSubset ?? connectionsRef.current;
      // Each driver runs with the family the handshake identified; switching
      // the toolbar family must not retarget live drivers.
      const settled = await Promise.allSettled(
        devices.map((d) => executeProtocolWithDriver(d.driver, d.family, protocolCode)),
      );
      if (!isActive(token)) return currentCells;
      return finishDeviceFanOut(
        cell.id,
        devices,
        settled,
        performance.now() - startTime,
        currentCells,
        "Execution failed",
        (data) => data as Record<string, unknown>,
        token,
      );
    },
    [setCellState, finishDeviceFanOut, isActive],
  );

  // Dynamic (ref) command: resolve separately for each target connection via
  // the shared resolver, then dispatch only devices that resolved. A failed
  // resolution is a rejected per-device outcome with NO transport call; valid
  // devices still run. Resolved values/errors surface as runtime previews only.
  const runDynamicCommandCell = useCallback(
    async (
      cell: CommandCell,
      currentCells: WorkbookCell[],
      token: RunToken,
      deviceSubset?: IotDeviceConnection[],
    ): Promise<WorkbookCell[]> => {
      const devices = deviceSubset ?? connectionsRef.current;
      if (devices.length === 0) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "No device connected - connect a device to run this command",
          ),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();
      const provenance = token.provenance;

      const perDevice = await Promise.all(
        devices.map(async (d) => {
          const resolution = resolveCommandPayload({
            commandCell: cell,
            cells: currentCells,
            targetDeviceId: d.id,
            activeProvenance: provenance,
            getRuntimeCellOutput,
          });
          if (!resolution.ok) {
            reportResolutionFailure(resolution.error, provenance);
            return {
              settled: {
                status: "rejected" as const,
                reason: new Error(RESOLUTION_FAILURE_MESSAGES[resolution.error.code]),
              },
              preview: { deviceId: d.id, deviceLabel: d.label, errorCode: resolution.error.code },
            };
          }
          const resolved = resolution.value;
          const preview = {
            deviceId: d.id,
            deviceLabel: d.label,
            resolved: typeof resolved === "string" ? resolved : JSON.stringify(resolved),
          };
          try {
            const value = await executeCommandWithDriver(d.driver, resolved);
            return { settled: { status: "fulfilled" as const, value }, preview };
          } catch (err) {
            return { settled: { status: "rejected" as const, reason: err }, preview };
          }
        }),
      );

      // Transport may already have fired, but a superseded run commits nothing:
      // no preview repopulation, no registry/display mutation.
      if (!isActive(token)) return currentCells;

      setCommandPreviews((prev) => ({
        ...prev,
        [cell.id]: { perDevice: perDevice.map((p) => p.preview) },
      }));

      return finishDeviceFanOut(
        cell.id,
        devices,
        perDevice.map((p) => p.settled),
        performance.now() - startTime,
        currentCells,
        "Command execution failed",
        toOutputData,
        token,
      );
    },
    [setCellState, getRuntimeCellOutput, finishDeviceFanOut, isActive, reportResolutionFailure],
  );

  const runCommandCell = useCallback(
    async (
      cell: CommandCell,
      currentCells: WorkbookCell[],
      token: RunToken,
      deviceSubset?: IotDeviceConnection[],
    ) => {
      if (isReferencedCommandPayload(cell.payload)) {
        return runDynamicCommandCell(cell, currentCells, token, deviceSubset);
      }

      let command: string | Record<string, unknown> | unknown[];
      try {
        command = resolveInlineCommand(cell.payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid command content";
        setCellState(cell.id, { status: "error", error: message });
        return insertOutputAfterCell(currentCells, cell.id, makeErrorOutputCell(cell.id, message));
      }

      if (connectionsRef.current.length === 0) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "No device connected - connect a device to run this command",
          ),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      const devices = deviceSubset ?? connectionsRef.current;
      const settled = await Promise.allSettled(
        devices.map((d) => executeCommandWithDriver(d.driver, command)),
      );
      if (!isActive(token)) return currentCells;
      return finishDeviceFanOut(
        cell.id,
        devices,
        settled,
        performance.now() - startTime,
        currentCells,
        "Command execution failed",
        toOutputData,
        token,
      );
    },
    [setCellState, finishDeviceFanOut, runDynamicCommandCell, isActive],
  );

  // Runs the macro once against one device's measurement; throws on failure.
  const executeMacroOn = useCallback(
    async (macroId: string, data: Record<string, unknown>, context?: Record<string, unknown>) => {
      let result;
      try {
        result = await executeMacroMutationRef.current.mutateAsync({ id: macroId, data, context });
      } catch (err) {
        // oRPC throws an ORPCError on HTTP errors; surface the server's message.
        throw new Error(parseApiError(err)?.message ?? "Macro execution failed");
      }
      if (!result.success) {
        throw new Error(result.error ?? "Macro execution failed");
      }
      return result.output;
    },
    [],
  );

  // The $device entry a macro run for this connection reads from ctx.
  const deviceContextFor = useCallback((deviceId?: string) => {
    const connections = connectionsRef.current;
    const index = deviceId ? connections.findIndex((c) => c.id === deviceId) : 0;
    const connection = connections.at(Math.max(index, 0));
    return connection ? toDeviceContext(connection.identity, Math.max(index, 0)) : undefined;
  }, []);

  const runMacroCell = useCallback(
    async (cell: MacroCell, cellIndex: number, currentCells: WorkbookCell[], token: RunToken) => {
      const input = findPrecedingOutput(currentCells, cellIndex);
      // Display-only device identity (family/deviceName) sourced from the input
      // cell, keyed by device id. Enriches the macro's OUTPUT cell so results
      // show which device they came from; kept OFF the runtime registry, whose
      // device results are a strict {id,label,data,error} envelope.
      const inputResults = input?.deviceResults;
      const identityForDevice = (
        deviceId: string,
      ): Pick<OutputDeviceResult, "family" | "deviceName"> => {
        const match = inputResults?.find((r) => r.deviceId === deviceId);
        return match ? { family: match.family, deviceName: match.deviceName } : {};
      };
      // A Map hit is not freshness: the predecessor is authoritative only when
      // its provenance matches the CURRENT design key + epoch (a workbook-key
      // swap updates the ref in render while the registry clears only in the
      // passive effect). A mismatch is treated like a missing predecessor below.
      const candidate = input ? getRuntimeCellOutput(input.producedBy) : undefined;
      const predecessor =
        candidate && hasMatchingProvenance(candidate.provenance, token.provenance)
          ? candidate
          : undefined;
      const namespace = buildCellNamespace(currentCells, cellIndex);
      // A macro can run from ctx alone; error only when there is neither a
      // nearest measurement nor any upstream output to read.
      if (!input && Object.keys(namespace.byId).length === 0) {
        setCellState(cell.id, { status: "error", error: "No input data available" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No measurement data available - run a protocol cell first"),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      // DEVICE-SCOPED: the fresh predecessor registry entry is the sole source
      // of multiplicity, exact device ids, per-device inputs, and errors. The
      // display output's `deviceResults` is never consulted, so an output-only
      // display mutation cannot fabricate or promote a device-scoped result.
      if (predecessor?.scope === "device") {
        const settled: PromiseSettledResult<unknown>[] = [];
        for (const r of predecessor.deviceResults) {
          // Re-check before launching each device's work; stop once superseded.
          if (!isActive(token)) return currentCells;
          if (r.error !== undefined) {
            settled.push({ status: "rejected", reason: new Error(r.error) });
            continue;
          }
          if (r.data === undefined) {
            settled.push({
              status: "rejected",
              reason: new Error("No measurement data from this device"),
            });
            continue;
          }
          try {
            const ns = buildCellNamespace(currentCells, cellIndex, {
              deviceId: r.deviceId,
              device: deviceContextFor(r.deviceId),
            });
            settled.push({
              status: "fulfilled",
              value: await executeMacroOn(
                cell.payload.macroId,
                r.data as Record<string, unknown>,
                ns.ctx,
              ),
            });
          } catch (err) {
            settled.push({ status: "rejected", reason: err });
          }
        }
        if (!isActive(token)) return currentCells;
        const executionTime = performance.now() - startTime;

        // Normalize keyed by the predecessor's exact ids (one or many devices).
        const results = predecessor.deviceResults.map((r, i) => {
          const outcome = settled[i];
          return outcome.status === "fulfilled"
            ? { deviceId: r.deviceId, deviceLabel: r.deviceLabel, data: outcome.value }
            : {
                deviceId: r.deviceId,
                deviceLabel: r.deviceLabel,
                error:
                  outcome.reason instanceof Error
                    ? outcome.reason.message
                    : "Macro execution failed",
              };
        });
        recordRuntimeOutput(cell.id, {
          scope: "device",
          provenance: token.provenance,
          deviceResults: results,
        });

        // Display copy enriched with the input's device identity (family/device
        // name). The registry entry above stays a strict {id,label,data,error}.
        const displayResults: OutputDeviceResult[] = results.map((r) => ({
          ...r,
          ...identityForDevice(r.deviceId),
        }));
        const successes = displayResults.filter((r) => r.error === undefined);
        const failures = displayResults.filter((r) => r.error !== undefined);
        const messages = failures.map((f) => `${resultDisplayLabel(f)}: ${f.error}`);

        if (successes.length === 0) {
          setCellState(cell.id, {
            status: "error",
            error: failures[0]?.error ?? "Macro execution failed",
          });
          return insertOutputAfterCell(currentCells, cell.id, {
            ...makeOutputCell(cell.id, undefined, executionTime, messages),
            deviceResults: displayResults,
          });
        }

        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeOutputCell(
            cell.id,
            successes[0].data as Record<string, unknown>,
            executionTime,
            messages,
          ),
          deviceResults: displayResults,
        });
      }

      // A preceding output exists but has NO fresh shared registry entry (a
      // stale/persisted display output after mount/Clear/epoch change; device
      // predecessors were handled above). Fail closed: never feed display `data`
      // to the macro nor record a resolver-eligible shared result from it.
      if (input && predecessor?.scope !== "shared") {
        setCellState(cell.id, {
          status: "error",
          error: "The upstream result is stale; run its cell again",
        });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "The upstream result is stale - re-run the producing cell before this macro",
          ),
        );
      }

      // SHARED / WORKBOOK: a fresh shared predecessor supplies the input, or (no
      // preceding output at all) the macro runs from workbook ctx with `{}`. The
      // result records `shared` and fans out on resolve.
      try {
        const sharedInput =
          predecessor?.scope === "shared" ? (predecessor.data as Record<string, unknown>) : {};
        const ns = buildCellNamespace(currentCells, cellIndex, {
          device: deviceContextFor(),
        });
        const output = await executeMacroOn(cell.payload.macroId, sharedInput, ns.ctx);
        if (!isActive(token)) return currentCells;
        const executionTime = performance.now() - startTime;
        setCellState(cell.id, { status: "completed" });
        // Record the shared (device-neutral) result for downstream resolution,
        // AND enrich the display output with the single input device's identity
        // when the macro ran off exactly one input device (main's per-device
        // identity on output cells). Both coexist.
        recordRuntimeOutput(cell.id, {
          scope: "shared",
          provenance: token.provenance,
          data: output,
        });
        const singleInputIdentity = inputResults?.length === 1 ? inputResults[0] : undefined;
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeOutputCell(cell.id, output, executionTime, []),
          ...(singleInputIdentity
            ? {
                deviceResults: [
                  {
                    deviceId: singleInputIdentity.deviceId,
                    deviceLabel: singleInputIdentity.deviceLabel,
                    family: singleInputIdentity.family,
                    deviceName: singleInputIdentity.deviceName,
                    data: output,
                  },
                ],
              }
            : {}),
        });
      } catch (err) {
        // A rejection from a superseded run must not repaint the cell error.
        if (!isActive(token)) return currentCells;
        const executionTime = performance.now() - startTime;
        const message = err instanceof Error ? err.message : "Macro execution failed";
        setCellState(cell.id, { status: "error", error: message });
        const singleInputIdentity = inputResults?.length === 1 ? inputResults[0] : undefined;
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeErrorOutputCell(cell.id, message, executionTime),
          ...(singleInputIdentity
            ? {
                deviceResults: [
                  {
                    deviceId: singleInputIdentity.deviceId,
                    deviceLabel: singleInputIdentity.deviceLabel,
                    family: singleInputIdentity.family,
                    deviceName: singleInputIdentity.deviceName,
                    error: message,
                  },
                ],
              }
            : {}),
        });
      }
    },
    [
      setCellState,
      executeMacroOn,
      deviceContextFor,
      recordRuntimeOutput,
      getRuntimeCellOutput,
      isActive,
    ],
  );

  const runQuestionCell = useCallback(
    async (
      cell: QuestionCell,
      currentCells: WorkbookCell[],
      token: RunToken,
    ): Promise<WorkbookCell[]> => {
      if (!cell.question.text.trim()) {
        setCellState(cell.id, { status: "error", error: "Question text is required" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "Question text is required: add a question before running"),
        );
      }

      const promptFn = onPromptQuestionRef.current;
      if (!promptFn) return currentCells;

      setCellState(cell.id, { status: "running" });

      try {
        const answer = await promptFn(cell);
        if (!isActive(token)) return currentCells;
        if (answer === undefined) {
          setCellState(cell.id, { status: "idle" });
          return currentCells;
        }

        setCellState(cell.id, { status: "completed" });
        // The current-cycle answer is a shared value adapted as `{ answer }`.
        recordRuntimeOutput(cell.id, runtimeOutputFromQuestionAnswer(answer, token.provenance));
        const updated = currentCells.map((c) =>
          c.id === cell.id ? { ...cell, answer, isAnswered: true } : c,
        );
        return insertOutputAfterCell(updated, cell.id, makeOutputCell(cell.id, { answer }, 0, []));
      } catch {
        if (!isActive(token)) return currentCells;
        setCellState(cell.id, { status: "error", error: "Question prompt failed" });
        return currentCells;
      }
    },
    [setCellState, recordRuntimeOutput, isActive],
  );

  /**
   * Device-scoped branch = dispatcher: every connected device evaluates the
   * branch with ITS identity, devices group by resolved path, and each path's
   * protocol/command target runs against only its group. Devices matching no
   * path are skipped with a message, never an error. No jump: execution
   * continues after the branch, and consumed targets are skipped once. Consumed
   * ids live on the run-local `ctx`, never a shared hook set.
   */
  const runDeviceDispatchBranch = useCallback(
    async (
      cell: BranchCell,
      currentCells: WorkbookCell[],
      ctx: RunContext,
    ): Promise<WorkbookCell[]> => {
      const connections = connectionsRef.current;
      if (connections.length === 0) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No device connected - connect devices to dispatch"),
        );
      }

      const groups = new Map<string, IotDeviceConnection[]>();
      const skipped: IotDeviceConnection[] = [];
      connections.forEach((connection, index) => {
        const path = evaluateBranch(cell, currentCells, {
          device: toDeviceContext(connection.identity, index),
          deviceId: connection.id,
        });
        const target = path?.gotoCellId
          ? currentCells.find((c) => c.id === path.gotoCellId)
          : undefined;
        if (path && target && (target.type === "protocol" || target.type === "command")) {
          const group = groups.get(path.id);
          if (group) group.push(connection);
          else groups.set(path.id, [connection]);
        } else {
          skipped.push(connection);
        }
      });

      let updated = currentCells;
      const messages: string[] = [];
      for (const path of cell.paths) {
        const group = groups.get(path.id);
        if (!group || group.length === 0 || !path.gotoCellId) continue;
        const target = updated.find((c) => c.id === path.gotoCellId);
        if (!target) continue;
        messages.push(`${path.label || "Unnamed path"} -> ${group.map((g) => g.label).join(", ")}`);
        ctx.consumed.add(target.id);
        updated =
          target.type === "protocol"
            ? await runProtocolCell(target, updated, ctx.token, group)
            : target.type === "command"
              ? await runCommandCell(target, updated, ctx.token, group)
              : updated;
        if (!isActive(ctx.token)) return currentCells;
      }
      for (const s of skipped) {
        messages.push(`${s.label} (${s.family}): no measurement resolved this round`);
      }

      if (!isActive(ctx.token)) return currentCells;
      setCellState(cell.id, { status: "completed" });
      updated = insertOutputAfterCell(
        updated,
        cell.id,
        makeOutputCell(cell.id, undefined, 0, messages),
      );
      // A dispatcher matches several paths at once; no single ACTIVE path.
      return updated.map((c) => (c.id === cell.id ? { ...cell, evaluatedPathId: undefined } : c));
    },
    [setCellState, runProtocolCell, runCommandCell, isActive],
  );

  const runBranchCell = useCallback(
    async (
      cell: BranchCell,
      currentCells: WorkbookCell[],
      ctx: RunContext,
      pass?: number,
    ): Promise<WorkbookCell[]> => {
      setCellState(cell.id, { status: "running" });

      const configErrors = [
        ...validateBranchCell(cell),
        ...validateDeviceBranch(cell, currentCells),
      ];
      if (configErrors.length > 0) {
        setCellState(cell.id, { status: "error", error: configErrors.join("; ") });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, undefined, 0, configErrors),
        );
      }

      if (isDeviceScopedBranch(cell)) {
        return runDeviceDispatchBranch(cell, currentCells, ctx);
      }

      const matchedPath = evaluateBranch(cell, currentCells);
      setCellState(cell.id, { status: "completed" });

      const passLabel = pass != null ? ` (pass ${pass})` : "";
      const messages = matchedPath
        ? [`Matched: ${matchedPath.label || "Unnamed path"}${passLabel}`]
        : [`No path matched${passLabel}`];

      const updated = insertOutputAfterCell(
        currentCells,
        cell.id,
        makeOutputCell(cell.id, undefined, 0, messages),
      );
      return updated.map((c) =>
        c.id === cell.id ? { ...cell, evaluatedPathId: matchedPath?.id } : c,
      );
    },
    [setCellState, runDeviceDispatchBranch],
  );

  const dispatchCell = useCallback(
    async (
      cell: WorkbookCell,
      currentCells: WorkbookCell[],
      ctx: RunContext,
      pass?: number,
    ): Promise<WorkbookCell[]> => {
      const cellIndex = currentCells.findIndex((c) => c.id === cell.id);

      const order = ++execCounterRef.current;
      setExecutionStates((prev) => {
        const existing = prev[cell.id] as CellExecutionState | undefined;
        const prevOrder = existing?.executionOrder ?? [];
        return {
          ...prev,
          [cell.id]: {
            ...existing,
            status: "running" as const,
            executionOrder: [...prevOrder, order],
          },
        };
      });

      switch (cell.type) {
        case "protocol":
          return runProtocolCell(cell, currentCells, ctx.token);
        case "command":
          return runCommandCell(cell, currentCells, ctx.token);
        case "macro":
          return runMacroCell(cell, cellIndex, currentCells, ctx.token);
        case "question":
          return runQuestionCell(cell, currentCells, ctx.token);
        case "branch":
          return runBranchCell(cell, currentCells, ctx, pass);
        default:
          return currentCells;
      }
    },
    [runProtocolCell, runCommandCell, runMacroCell, runQuestionCell, runBranchCell],
  );

  // Returns the jump index into `currentCells`, or -1 if no jump.
  const resolveBranchJump = (branchCellId: string, currentCells: WorkbookCell[]): number => {
    const branch = currentCells.find((c) => c.id === branchCellId);
    if (branch?.type !== "branch" || !branch.evaluatedPathId) return -1;
    const matchedPath = branch.paths.find((p) => p.id === branch.evaluatedPathId);
    if (!matchedPath?.gotoCellId) return -1;
    return currentCells.findIndex((c) => c.id === matchedPath.gotoCellId);
  };

  // Commit ONE dispatch step's field-scoped delta (before -> after). The
  // pre-enqueue `isActive` is only an optimization; the transform re-checks
  // `isActive` when React APPLIES it, so a transform queued before a Clear /
  // authored invalidation / workbook-key change becomes a no-op at apply time.
  const commitStep = useCallback(
    (token: RunToken, before: WorkbookCell[], after: WorkbookCell[]) => {
      if (!isActive(token)) return false;
      onCellsChangeRef.current((latest) =>
        isActive(token) ? applyExecutionDelta(latest, before, after) : latest,
      );
      return true;
    },
    [isActive],
  );

  const runCell = useCallback(
    async (cellId: string) => {
      let currentCells = cellsRef.current;
      const cell = currentCells.find((c) => c.id === cellId);
      if (!cell) return;

      // Run-local context: this run's token + its own consumed-target set.
      const ctx: RunContext = { token: captureToken(), consumed: new Set() };
      let before = currentCells;
      currentCells = await dispatchCell(cell, currentCells, ctx);
      if (!commitStep(ctx.token, before, currentCells)) return;

      if (cell.type === "branch") {
        const jumpIndex = resolveBranchJump(cell.id, currentCells);
        if (jumpIndex !== -1) {
          const visitCounts = new Map<string, number>();
          const MAX_VISITS = 100;

          for (let i = jumpIndex; i < currentCells.length; i++) {
            const c = currentCells[i];
            if (c.type === "output" || c.type === "markdown") continue;

            if (ctx.consumed.has(c.id)) {
              ctx.consumed.delete(c.id);
              continue;
            }

            const count = visitCounts.get(c.id) ?? 0;
            if (count >= MAX_VISITS) continue;
            visitCounts.set(c.id, count + 1);

            before = currentCells;
            currentCells = await dispatchCell(c, currentCells, ctx, count + 1);
            if (!commitStep(ctx.token, before, currentCells)) return;

            if (c.type === "branch") {
              const nestedJump = resolveBranchJump(c.id, currentCells);
              if (nestedJump !== -1) i = nestedJump - 1;
            }
          }
        }
      }
    },
    [dispatchCell, commitStep, captureToken],
  );

  // Extracted so TS does not narrow abortRef.current to its initial value across awaits.
  const shouldAbort = () => abortRef.current;

  const runAll = useCallback(async () => {
    // Reset everything (registry/previews/states/running) via the common
    // invalidator FIRST, then set this run's own fresh UI state. Capturing the
    // token after the bump makes any older manual run inert.
    invalidateRuntime();
    setIsRunningAll(true);
    abortRef.current = false;
    // Run-local context: this run's token + its own consumed-target set.
    const ctx: RunContext = { token: captureToken(), consumed: new Set() };

    let currentCells = [...cellsRef.current];
    const visitCounts = new Map<string, number>();
    const MAX_VISITS_PER_CELL = 100;

    for (let i = 0; i < currentCells.length; i++) {
      if (shouldAbort()) break;

      const cell = currentCells[i];

      if (cell.type === "output" || cell.type === "markdown") continue;

      // A device-scoped branch already ran this target with its device group;
      // skip it exactly once.
      if (ctx.consumed.has(cell.id)) {
        ctx.consumed.delete(cell.id);
        continue;
      }

      // Cap revisits to avoid infinite loops from branch jumps.
      const count = visitCounts.get(cell.id) ?? 0;
      if (count >= MAX_VISITS_PER_CELL) continue;
      visitCounts.set(cell.id, count + 1);

      const before = currentCells;
      currentCells = await dispatchCell(cell, currentCells, ctx, count + 1);
      // A newer invalidation (edit, Clear, another Run all) superseded this run;
      // stop without committing and leave isRunningAll to the active generation.
      if (!commitStep(ctx.token, before, currentCells)) return;

      if (cell.type === "branch") {
        const jumpIndex = resolveBranchJump(cell.id, currentCells);
        if (jumpIndex !== -1) i = jumpIndex - 1;
      }
    }

    setIsRunningAll(false);
  }, [dispatchCell, invalidateRuntime, commitStep, captureToken]);

  const stopExecution = useCallback(() => {
    abortRef.current = true;
  }, []);

  const clearOutputs = useCallback(() => {
    // Explicit all-output removal applied to the latest state (never a stale
    // snapshot), so a concurrent authored edit is not resurrected.
    onCellsChangeRef.current((latest) => latest.filter((c) => c.type !== "output"));
    invalidateRuntime();
  }, [invalidateRuntime]);

  const connectDevice = useCallback(() => connect(connectionType), [connect, connectionType]);

  return {
    isConnected,
    isConnecting,
    connectedDevices: connections.map(({ id, label, ordinal, family, identity }) => ({
      id,
      label,
      ordinal,
      family,
      name: identity.name,
      stableId: identity.deviceId,
    })),
    sensorFamily,
    setSensorFamily,
    connectionType,
    setConnectionType,
    connect: connectDevice,
    disconnect: disconnectAll,
    disconnectDevice,

    executionStates,
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
    // Runtime-only resolved value/error per device for each dynamic command
    // cell; cleared on every invalidation. Display-only, never persisted.
    commandPreviews,
    // Synchronous invalidator the host wires to the executable-edit context.
    // Editing protocol/macro code (or a successful fork) calls this BEFORE any
    // local/editor state change, so an in-flight producer cannot commit against
    // stale code. No passive effect between the edit and the generation bump.
    invalidateExecutableDesign: invalidateRuntime,
  };
}
