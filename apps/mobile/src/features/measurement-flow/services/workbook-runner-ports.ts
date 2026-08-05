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
  analysisGate: BroadcastUserGate;
  getProtocolCode: (protocolId: string) => Record<string, unknown>[] | null;
  getMacroMeta: (macroId: string) => MacroMeta | null;
  getExecutors?: () => ReadonlyMap<string, DeviceExecutorEntry>;
  executeAssignments?: ExecuteAssignments;
  cancelDevices?: (deviceIds: string[]) => Promise<void>;
  /** Set by the host when partial-success UI chooses Continue instead of Retry. */
  shouldContinueAfterPartial?: () => boolean;
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
  return {
    async execute(
      input: CommandRunInput,
      opts: { signal: AbortSignal; onProgress: (progress: CommandProgress) => void },
    ): Promise<DeviceOutcome[]> {
      await deps.scanGate.wait(opts.signal);

      const scannerModule =
        deps.getExecutors && deps.executeAssignments && deps.cancelDevices
          ? undefined
          : await import("~/features/connection/stores/use-scanner-command-executor-store");
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
        void cancelDevices(input.deviceIds).catch(() => undefined);
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
        const accumulated = new Map<string, DeviceOutcome>();
        let pendingDeviceIds = [...input.deviceIds];

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
          deps.onScanRound?.({ ...input, deviceIds: pendingDeviceIds }, round, roundOutcomes);

          if (round.failures.length === 0) break;
          if (!roundOutcomes.some((outcome) => outcome.data !== undefined)) {
            deps.onScanError?.(round.failures[0]?.error ?? new Error("Command execution failed"));
          }
          pendingDeviceIds = round.failures.map(({ device }) => device.id);
          await deps.scanGate.wait(opts.signal);
          if (deps.shouldContinueAfterPartial?.()) break;
        }

        const outcomes = input.deviceIds.map(
          (deviceId): DeviceOutcome =>
            accumulated.get(deviceId) ?? {
              deviceId,
              deviceLabel: deviceId,
              family: input.family,
              error: "Command execution did not produce an outcome",
            },
        );
        if (outcomes.some((outcome) => outcome.data !== undefined)) {
          deps.onScanSuccess?.(input, outcomes);
        }
        return outcomes;
      } catch (error) {
        if (!opts.signal.aborted) deps.onScanError?.(error);
        throw error;
      } finally {
        opts.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

function createMacroRunner(deps: MobileRunnerPortsDeps): MacroRunnerPort {
  return {
    async run(input: MacroRunInput, opts: { signal: AbortSignal }) {
      const resultPromise = (async (): Promise<Record<string, unknown>> => {
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
          deps.onMacroOutput?.(input, output);
          return output;
        } catch {
          // Current mobile analysis renders macro errors without blocking
          // navigation/upload, so the port preserves that non-fatal behavior.
          return {};
        }
      })();
      resultPromise.catch(() => undefined);
      await deps.analysisGate.wait(opts.signal);
      return resultPromise;
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
