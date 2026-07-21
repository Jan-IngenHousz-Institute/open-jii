import { create } from "zustand";
import type {
  CommandProgress,
  ExecuteOptions,
  IMultispeqCommandExecutor,
} from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { createMultispeqCommandExecutor } from "~/features/connection/services/scan-manager/utils/create-multispeq-command-executor";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

import type { DeviceIdentity } from "@repo/iot";
import { estimateProtocolDurationMs } from "@repo/iot";

const log = createLogger("scanner-executor");

export interface DeviceExecutorEntry {
  device: Device;
  executor: IMultispeqCommandExecutor;
  /**
   * Identification-handshake result, patched in asynchronously after connect.
   * Undefined while the handshake is in flight or when it failed; consumers
   * must treat it as best-effort.
   */
  identity: DeviceIdentity | undefined;
  isExecuting: boolean;
  isCancelled: boolean;
  error: Error | undefined;
  commandResponse: string | object | undefined;
  /** Live progress of the entry's in-flight command (final-response transfer). */
  progress: CommandProgress | undefined;
  /** Epoch ms when the entry's current scan started; drives the elapsed-time UI. */
  scanStartedAt: number | undefined;
  /** Estimated protocol runtime (ms) for the in-flight command, if known. */
  estimatedMs: number | undefined;
}

export type DeviceCommandOutcome =
  | { device: Device; status: "fulfilled"; result: string | object }
  | { device: Device; status: "rejected"; error: Error };

interface ScannerCommandExecutorStore {
  // One entry per connected device, keyed by Device.id. Insertion order =
  // connect order; the first entry is the Primary device (see CONTEXT.md).
  executors: ReadonlyMap<string, DeviceExecutorEntry>;
  isInitializing: boolean;

  // Legacy single-device mirrors, derived from the entries after every
  // mutation. Primary's values, except isExecuting which is true when ANY
  // device is executing. Removable once all consumers read entries directly.
  commandExecutor: IMultispeqCommandExecutor | undefined;
  commandResponse: string | object | undefined;
  isExecuting: boolean;
  isCancelled: boolean;
  error: Error | undefined;
  progress: CommandProgress | undefined;
  scanStartedAt: number | undefined;
  estimatedMs: number | undefined;

  // Multi-device API
  addDevice: (device: Device) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  executeCommandOn: (
    deviceId: string,
    command: string | object,
    options?: ExecuteOptions,
  ) => Promise<string | object>;
  executeOnAll: (
    command: string | object,
    options?: ExecuteOptions,
  ) => Promise<DeviceCommandOutcome[]>;
  cancelCommandOn: (deviceId: string) => Promise<void>;
  cancelAll: () => Promise<void>;

  // Legacy single-device API: operates on the Primary device. setDevice keeps
  // its replace-all semantics; exactly the Bluetooth single-device behavior.
  setDevice: (device: Device | undefined) => Promise<void>;
  executeCommand: (
    command: string | object,
    options?: ExecuteOptions,
  ) => Promise<string | object | undefined>;
  cancelCommand: () => Promise<void>;
  reset: () => void;
  destroy: () => Promise<void>;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function freshEntry(device: Device, executor: IMultispeqCommandExecutor): DeviceExecutorEntry {
  return {
    device,
    executor,
    identity: undefined,
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    commandResponse: undefined,
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
  };
}

function syncLegacyFields(executors: ReadonlyMap<string, DeviceExecutorEntry>) {
  const primary: DeviceExecutorEntry | undefined = executors.values().next().value;
  let anyExecuting = false;
  executors.forEach((entry) => {
    anyExecuting ||= entry.isExecuting;
  });
  return {
    commandExecutor: primary?.executor,
    commandResponse: primary?.commandResponse,
    isExecuting: anyExecuting,
    isCancelled: primary?.isCancelled ?? false,
    error: primary?.error,
    progress: primary?.progress,
    scanStartedAt: primary?.scanStartedAt,
    estimatedMs: primary?.estimatedMs,
  };
}

export const useScannerCommandExecutorStore = create<ScannerCommandExecutorStore>((set, get) => {
  const setEntries = (executors: Map<string, DeviceExecutorEntry>) => {
    set({ executors, ...syncLegacyFields(executors) });
  };

  const patchEntry = (deviceId: string, patch: Partial<DeviceExecutorEntry>) => {
    const current = get().executors;
    const entry = current.get(deviceId);
    if (!entry) {
      return;
    }
    const next = new Map(current);
    next.set(deviceId, { ...entry, ...patch });
    setEntries(next);
  };

  const destroyExecutor = (executor: IMultispeqCommandExecutor) =>
    executor
      .destroy()
      .catch((e) => log.warn("executor destroy failed", { err: (e as Error)?.message }));

  // Best-effort, fire-and-patch: connect never blocks on identification, and a
  // failed handshake just leaves `identity` undefined ($device branches then
  // fall to their default path).
  const captureIdentity = (deviceId: string, executor: IMultispeqCommandExecutor) => {
    executor
      .getIdentity()
      .then((identity) => patchEntry(deviceId, { identity }))
      .catch((e) => log.warn("identity handshake failed", { err: (e as Error)?.message }));
  };

  return {
    executors: new Map(),
    isInitializing: false,
    commandExecutor: undefined,
    commandResponse: undefined,
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,

    addDevice: async (device: Device) => {
      // Deregister a prior executor for this device BEFORE destroying it, so
      // a failed re-initialization can't leave a dead executor registered.
      const prior = get().executors.get(device.id);
      if (prior) {
        const next = new Map(get().executors);
        next.delete(device.id);
        setEntries(next);
        await destroyExecutor(prior.executor);
      }

      try {
        const executor = await createMultispeqCommandExecutor(device);
        if (!executor) {
          return;
        }
        // Re-read after the await: a concurrent addDevice/removeDevice may
        // have replaced the map in the meantime.
        const next = new Map(get().executors);
        next.set(device.id, freshEntry(device, executor));
        setEntries(next);
        captureIdentity(device.id, executor);
      } catch (error) {
        set({ error: toError(error) });
      }
    },

    removeDevice: async (deviceId: string) => {
      const entry = get().executors.get(deviceId);
      if (!entry) {
        return;
      }
      // Delete before destroy so an in-flight executeCommandOn observes the
      // entry as gone and surfaces the executor's rejection as-is.
      const next = new Map(get().executors);
      next.delete(deviceId);
      setEntries(next);
      await destroyExecutor(entry.executor);
    },

    executeCommandOn: async (deviceId: string, command: string | object, options?) => {
      const entry = get().executors.get(deviceId);
      if (!entry) {
        const error = new Error("Command executor not initialized. No device connected.");
        set({ error });
        throw error;
      }

      // Background commands (battery polling) bypass all measurement-facing UI
      // state, including `isExecuting`, so the battery poller's `!isExecuting`
      // gate reflects measurements only.
      if (options?.background) {
        return entry.executor.execute(command, options);
      }

      // Estimated runtime sizes the elapsed-time progress bar. Console commands
      // (plain strings) estimate to 0 and are treated as indeterminate (no bar).
      const estimatedMs = estimateProtocolDurationMs(command) || undefined;
      patchEntry(deviceId, {
        isExecuting: true,
        isCancelled: false,
        error: undefined,
        progress: undefined,
        scanStartedAt: Date.now(),
        estimatedMs,
      });

      // Mirror live command progress into the entry while this execute runs.
      const unsubscribe = entry.executor.onProgress((progress) =>
        patchEntry(deviceId, { progress }),
      );

      try {
        const result = await entry.executor.execute(command, options);
        if (get().executors.get(deviceId)?.isCancelled) {
          throw new Error("Measurement cancelled");
        }
        patchEntry(deviceId, { commandResponse: result, isExecuting: false, error: undefined });
        return result;
      } catch (err) {
        // If cancelCommandOn preempted this execute() the underlying executor
        // rejects with a "superseded" error; surface the user-facing reason
        // instead so callers see a coherent cancellation message.
        const error = get().executors.get(deviceId)?.isCancelled
          ? new Error("Measurement cancelled")
          : toError(err);
        patchEntry(deviceId, { error, isExecuting: false });
        throw error;
      } finally {
        // Only the transfer indicator is cleared here; scanStartedAt/estimatedMs
        // linger so the bar reads "complete" until the flow navigates away, and
        // are overwritten by the next run (or cleared on reset/disconnect).
        unsubscribe();
        patchEntry(deviceId, { progress: undefined });
      }
    },

    executeOnAll: async (command: string | object, options?) => {
      const entries = Array.from(get().executors.values());
      const settled = await Promise.allSettled(
        entries.map((entry) => get().executeCommandOn(entry.device.id, command, options)),
      );
      return entries.map((entry, i): DeviceCommandOutcome => {
        const outcome = settled[i];
        return outcome.status === "fulfilled"
          ? { device: entry.device, status: "fulfilled", result: outcome.value }
          : { device: entry.device, status: "rejected", error: toError(outcome.reason) };
      });
    },

    cancelCommandOn: async (deviceId: string) => {
      patchEntry(deviceId, { isCancelled: true, isExecuting: false });
      const entry = get().executors.get(deviceId);
      if (!entry) {
        return;
      }
      try {
        // Preemptively abort the in-flight command on the driver. This sends the
        // `-1+` cancel switch to the device and rejects the running execute();
        // the in-flight executeCommandOn() then surfaces "Measurement cancelled".
        await entry.executor.cancel();
      } catch (err) {
        const error = toError(err);
        log.error("Failed to send cancel command", { err: error.message });
        patchEntry(deviceId, { error });
        throw error;
      }
    },

    cancelAll: async () => {
      const ids = Array.from(get().executors.keys());
      await Promise.allSettled(ids.map((deviceId) => get().cancelCommandOn(deviceId)));
    },

    setDevice: async (device: Device | undefined) => {
      // Prevent concurrent calls
      if (get().isInitializing) {
        return;
      }

      set({ isInitializing: true });

      try {
        // Replace-all: deregister every existing executor before destroying,
        // so an initialization failure can't leave dead executors registered.
        const existing = Array.from(get().executors.values());
        setEntries(new Map());
        for (const entry of existing) {
          await destroyExecutor(entry.executor);
        }

        const next = new Map<string, DeviceExecutorEntry>();
        let added: { deviceId: string; executor: IMultispeqCommandExecutor } | undefined;
        if (device) {
          const executor = await createMultispeqCommandExecutor(device);
          if (executor) {
            next.set(device.id, freshEntry(device, executor));
            added = { deviceId: device.id, executor };
          }
        }

        setEntries(next);
        set({ isInitializing: false, error: undefined });
        if (added) captureIdentity(added.deviceId, added.executor);
      } catch (error) {
        set({
          error: toError(error),
          isInitializing: false,
        });
      }
    },

    executeCommand: async (command: string | object, options?) => {
      const { executors, isInitializing } = get();
      if (isInitializing) {
        const error = new Error("Command executor is being initialized. Please wait.");
        set({ error, isExecuting: false });
        throw error;
      }
      const primary: DeviceExecutorEntry | undefined = executors.values().next().value;
      if (!primary) {
        const error = new Error("Command executor not initialized. No device connected.");
        set({ error, isExecuting: false });
        throw error;
      }
      return get().executeCommandOn(primary.device.id, command, options);
    },

    cancelCommand: async () => {
      const primary: DeviceExecutorEntry | undefined = get().executors.values().next().value;
      if (!primary) {
        set({ isCancelled: true, isExecuting: false });
        return;
      }
      await get().cancelCommandOn(primary.device.id);
    },

    reset: () => {
      const next = new Map<string, DeviceExecutorEntry>();
      get().executors.forEach((entry, deviceId) => {
        next.set(deviceId, {
          ...entry,
          commandResponse: undefined,
          error: undefined,
          isExecuting: false,
          isCancelled: false,
          progress: undefined,
          scanStartedAt: undefined,
          estimatedMs: undefined,
        });
      });
      setEntries(next);
      set({ error: undefined });
    },

    destroy: async () => {
      const entries = Array.from(get().executors.values());
      setEntries(new Map());
      set({ error: undefined });
      await Promise.allSettled(entries.map((entry) => destroyExecutor(entry.executor)));
    },
  };
});
