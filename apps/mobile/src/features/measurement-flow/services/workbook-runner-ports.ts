import { executeScanAssignments } from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type {
  MultiScanRound,
  ScanAssignment,
} from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type { DeviceExecutorEntry } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import type {
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
  DeviceOutcome,
  MacroRunInput,
  MacroRunnerPort,
  ProtocolCodeResolverPort,
  WorkbookRunnerPorts,
} from "@repo/workbook";

const CANCELLED_MESSAGE = "Measurement cancelled";

interface GateWaiter {
  release: () => void;
  reject: (error: Error) => void;
}

export interface AddressedGateToken {
  effectId: string;
  trackId: string;
  cellId: string;
  producerCellId?: string;
  deviceIds: string[];
}

interface AddressedGateWaiter extends GateWaiter {
  token: AddressedGateToken;
}

/** A FIFO human-interaction queue where only the presented effect may resume. */
export class AddressedUserGate {
  private readonly waiters = new Map<string, AddressedGateWaiter>();
  private readonly released = new Set<string>();

  constructor(private readonly onPendingChange?: (tokens: AddressedGateToken[]) => void) {}

  get pending(): AddressedGateToken[] {
    return Array.from(this.waiters.values(), ({ token }) => token);
  }

  release(effectId: string): boolean {
    const waiter = this.waiters.get(effectId);
    if (!waiter) return false;
    this.waiters.delete(effectId);
    this.released.add(effectId);
    this.emit();
    waiter.release();
    return true;
  }

  reset(): void {
    const waiters = [...this.waiters.values()];
    this.waiters.clear();
    this.released.clear();
    this.emit();
    for (const waiter of waiters) waiter.reject(new Error(CANCELLED_MESSAGE));
  }

  wait(token: AddressedGateToken, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Error(CANCELLED_MESSAGE));
    // Multi-device macro legs share one effect id. Once the researcher has
    // admitted the effect, every leg of that exact effect may finish.
    if (this.released.has(token.effectId)) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const waiter: AddressedGateWaiter = {
        token,
        release: () => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        },
        reject: (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      };
      const onAbort = () => {
        if (!this.waiters.delete(token.effectId)) return;
        this.emit();
        reject(new Error(CANCELLED_MESSAGE));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.waiters.set(token.effectId, waiter);
      this.emit();
    });
  }

  private emit(): void {
    this.onPendingChange?.(this.pending);
  }
}

/**
 * One user action releases every runner effect parked in the current scan
 * round. This is deliberately broadcast rather than one-shot: a device branch
 * emits one command effect per heterogeneous target subset, while mobile shows
 * one Start button for the whole assignment round.
 */
export class BroadcastUserGate {
  private readonly waiters = new Set<GateWaiter>();
  private preArmed = false;

  constructor(private readonly onPendingChange?: (pending: boolean) => void) {}

  get pending(): boolean {
    return this.waiters.size > 0;
  }

  arm(): void {
    if (this.waiters.size === 0) {
      // Keep the pre-arm alive through this microtask so every effect emitted
      // by one reducer turn observes the same user action.
      this.preArmed = true;
      void Promise.resolve().then(() => {
        this.preArmed = false;
      });
      return;
    }
    const waiters = [...this.waiters];
    this.waiters.clear();
    this.onPendingChange?.(false);
    for (const waiter of waiters) waiter.release();
  }

  reset(): void {
    this.preArmed = false;
    const waiters = [...this.waiters];
    this.waiters.clear();
    if (waiters.length > 0) this.onPendingChange?.(false);
    for (const waiter of waiters) waiter.reject(new Error(CANCELLED_MESSAGE));
  }

  wait(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Error(CANCELLED_MESSAGE));
    if (this.preArmed) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const waiter: GateWaiter = {
        release: () => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        },
        reject: (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      };
      const onAbort = () => {
        if (!this.waiters.delete(waiter)) return;
        if (this.waiters.size === 0) this.onPendingChange?.(false);
        reject(new Error(CANCELLED_MESSAGE));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.waiters.add(waiter);
      if (this.waiters.size === 1) this.onPendingChange?.(true);
    });
  }
}

export interface MacroMeta {
  /** Base64 source, as delivered in the workbook version's entity snapshots. */
  code: string;
  language: string;
}

type ExecuteAssignments = (
  assignments: ScanAssignment[],
  options?: { prefailed?: { device: Device; error: Error }[]; timeoutMs?: number },
) => Promise<MultiScanRound>;

export interface MobileRunnerPortsDeps {
  scanGate: BroadcastUserGate;
  analysisGate: AddressedUserGate;
  getProtocolCode: (protocolId: string) => Record<string, unknown>[] | null;
  getMacroMeta: (macroId: string) => MacroMeta | null;
  getExecutors?: () => ReadonlyMap<string, DeviceExecutorEntry>;
  executeAssignments?: ExecuteAssignments;
  cancelDevices?: (deviceIds: string[]) => Promise<void>;
  /** Refresh broadcast targets at tap time; dispatch/lane subsets remain frozen. */
  resolveDeviceIds?: (input: CommandRunInput) => string[];
  /** Set by the host when partial-success UI chooses Continue instead of Retry. */
  shouldContinueAfterPartial?: () => boolean;
  /** Changes on reset, experiment selection, cycle rotation and retry attempt. */
  getExecutionGeneration?: () => string;
  onScanRound?: (input: CommandRunInput, round: MultiScanRound, outcomes: DeviceOutcome[]) => void;
  onScanError?: (error: unknown) => void;
  onScanSuccess?: (input: CommandRunInput, outcomes: DeviceOutcome[]) => void;
  onMacroOutput?: (input: MacroRunInput, output: Record<string, unknown>) => void;
}

function executorIdentity(entry: DeviceExecutorEntry, input: CommandRunInput): DeviceOutcome {
  return {
    // Runtime device scoping is keyed by the host connection id. The
    // handshake identity remains available as deviceName/family metadata.
    deviceId: entry.device.id,
    deviceLabel: entry.device.name,
    family: entry.identity?.family ?? input.family,
    deviceName: entry.identity?.name ?? entry.device.name,
  };
}

function createCommandExecutor(deps: MobileRunnerPortsDeps): CommandExecutorPort {
  const retainedByRun = new Map<
    string,
    { accumulated: Map<string, DeviceOutcome>; pendingDeviceIds: string[] }
  >();
  let retainedGeneration: string | undefined;
  let scannerModulePromise:
    | Promise<typeof import("~/features/connection/stores/use-scanner-command-executor-store")>
    | undefined;
  const loadScannerModule = () =>
    (scannerModulePromise ??= import(
      "~/features/connection/stores/use-scanner-command-executor-store"
    ));

  return {
    async execute(
      input: CommandRunInput,
      opts: {
        signal: AbortSignal;
        effectId?: string;
        onProgress: (progress: CommandProgress) => void;
      },
    ): Promise<DeviceOutcome[]> {
      const generation = deps.getExecutionGeneration?.() ?? "default";
      if (retainedGeneration !== generation) {
        retainedByRun.clear();
        retainedGeneration = generation;
      }
      const isCurrent = () =>
        !opts.signal.aborted && (deps.getExecutionGeneration?.() ?? "default") === generation;
      await deps.scanGate.wait(opts.signal);
      const targetedDeviceIds = deps.resolveDeviceIds?.(input) ?? input.deviceIds;
      const runKey = `${generation}:${input.trackId}:${input.cellId}`;

      const scannerModule =
        deps.getExecutors && deps.executeAssignments && deps.cancelDevices
          ? undefined
          : await loadScannerModule();
      const scannerStore = scannerModule?.useScannerCommandExecutorStore;
      const getExecutors =
        deps.getExecutors ?? (() => scannerStore?.getState().executors ?? new Map());
      const cancelDevices =
        deps.cancelDevices ??
        ((deviceIds: string[]) =>
          Promise.allSettled(
            deviceIds.map(
              (deviceId) => scannerStore?.getState().cancelCommandOn(deviceId) ?? Promise.resolve(),
            ),
          ).then(() => undefined));
      const onAbort = () => {
        void cancelDevices(targetedDeviceIds).catch(() => undefined);
      };
      opts.signal.addEventListener("abort", onAbort, { once: true });

      try {
        const runAssignments: ExecuteAssignments =
          deps.executeAssignments ??
          ((assignments, options) =>
            executeScanAssignments(assignments, {
              ...options,
              executeCommandOn:
                scannerStore?.getState().executeCommandOn ??
                (() => {
                  throw new Error("Scanner command executor store is unavailable");
                }),
            }));
        const retained = retainedByRun.get(runKey);
        const accumulated = new Map(retained?.accumulated ?? []);
        let pendingDeviceIds = retained?.pendingDeviceIds.filter((id) =>
          targetedDeviceIds.includes(id),
        ) ?? [...targetedDeviceIds];

        while (pendingDeviceIds.length > 0) {
          const executors = getExecutors();
          const assignments: ScanAssignment[] = [];
          const prefailed: { device: Device; error: Error }[] = [];
          const missing = new Map<string, DeviceOutcome>();
          const unsubscribers: (() => void)[] = [];

          for (const deviceId of pendingDeviceIds) {
            const entry = executors.get(deviceId);
            if (!entry) {
              const error = new Error(`Command executor not initialized for device ${deviceId}`);
              const device: Device = { id: deviceId, name: deviceId, type: "usb" };
              prefailed.push({ device, error });
              missing.set(deviceId, {
                deviceId,
                deviceLabel: deviceId,
                family: input.family,
                error: error.message,
              });
              continue;
            }
            assignments.push({ device: entry.device, command: input.command });
            unsubscribers.push(entry.executor.onProgress(opts.onProgress));
          }

          let round: MultiScanRound;
          try {
            round = await runAssignments(assignments, {
              prefailed,
              timeoutMs: input.timeoutMs,
            });
          } finally {
            for (const unsubscribe of unsubscribers) unsubscribe();
          }

          const successes = new Map(round.successes.map((success) => [success.device.id, success]));
          const failures = new Map(round.failures.map((failure) => [failure.device.id, failure]));
          const roundOutcomes = pendingDeviceIds.map((deviceId): DeviceOutcome => {
            const missingOutcome = missing.get(deviceId);
            if (missingOutcome) return missingOutcome;
            const entry = executors.get(deviceId);
            if (!entry) {
              return {
                deviceId,
                deviceLabel: deviceId,
                family: input.family,
                error: "Device missing",
              };
            }
            const identity = executorIdentity(entry, input);
            const success = successes.get(deviceId);
            if (success) return { ...identity, data: success.result };
            return {
              ...identity,
              error: failures.get(deviceId)?.error.message ?? "Command execution failed",
            };
          });
          for (const outcome of roundOutcomes) accumulated.set(outcome.deviceId, outcome);
          if (isCurrent()) {
            deps.onScanRound?.({ ...input, deviceIds: pendingDeviceIds }, round, roundOutcomes);
          }

          if (round.failures.length === 0) {
            retainedByRun.delete(runKey);
            break;
          }
          if (isCurrent() && !roundOutcomes.some((outcome) => outcome.data !== undefined)) {
            deps.onScanError?.(round.failures[0]?.error ?? new Error("Command execution failed"));
          }
          pendingDeviceIds = round.failures.map(({ device }) => device.id);
          if (isCurrent()) {
            retainedByRun.set(runKey, {
              accumulated: new Map(accumulated),
              pendingDeviceIds: [...pendingDeviceIds],
            });
          }
          await deps.scanGate.wait(opts.signal);
          if (deps.shouldContinueAfterPartial?.()) {
            retainedByRun.delete(runKey);
            break;
          }
        }

        const outcomes = targetedDeviceIds.map(
          (deviceId): DeviceOutcome =>
            accumulated.get(deviceId) ?? {
              deviceId,
              deviceLabel: deviceId,
              family: input.family,
              error: "Command execution did not produce an outcome",
            },
        );
        if (opts.signal.aborted) throw new Error(CANCELLED_MESSAGE);
        retainedByRun.delete(runKey);
        if (isCurrent() && outcomes.some((outcome) => outcome.data !== undefined)) {
          deps.onScanSuccess?.(input, outcomes);
        }
        return outcomes;
      } catch (error) {
        if (isCurrent()) deps.onScanError?.(error);
        throw error;
      } finally {
        opts.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

function createMacroRunner(deps: MobileRunnerPortsDeps): MacroRunnerPort {
  return {
    async run(input: MacroRunInput, opts: { signal: AbortSignal; effectId?: string }) {
      const generation = deps.getExecutionGeneration?.() ?? "default";
      const effectId = opts.effectId ?? `${input.trackId}:${input.cellId}`;
      await deps.analysisGate.wait(
        {
          effectId,
          trackId: input.trackId,
          cellId: input.cellId,
          producerCellId: input.producerCellId,
          deviceIds: [...input.deviceIds],
        },
        opts.signal,
      );
      if (opts.signal.aborted || (deps.getExecutionGeneration?.() ?? "default") !== generation) {
        throw new Error(CANCELLED_MESSAGE);
      }
      const meta = deps.getMacroMeta(input.macroId);
      if (!meta || input.json === null || typeof input.json !== "object") return {};
      try {
        const { applyMacro } = await import(
          "~/features/measurement-flow/utils/process-scan/process-scan"
        );
        const outputs = await applyMacro(
          input.json,
          { code: meta.code, language: meta.language },
          input.ctx.ctx,
        );
        const output = outputs.length === 1 ? outputs[0] : { samples: outputs };
        if (!opts.signal.aborted && (deps.getExecutionGeneration?.() ?? "default") === generation) {
          deps.onMacroOutput?.(input, output);
        }
        return output;
      } catch {
        // Current mobile analysis renders macro errors without blocking
        // navigation/upload, so the port preserves that non-fatal behavior.
        return {};
      }
    },
  };
}

function createProtocolCodeResolver(deps: MobileRunnerPortsDeps): ProtocolCodeResolverPort {
  return {
    resolveProtocolCode(protocolId: string) {
      return Promise.resolve(deps.getProtocolCode(protocolId));
    },
  };
}

export function createMobileRunnerPorts(deps: MobileRunnerPortsDeps): WorkbookRunnerPorts {
  return {
    commandExecutor: createCommandExecutor(deps),
    macroRunner: createMacroRunner(deps),
    protocolCodeResolver: createProtocolCodeResolver(deps),
  };
}
