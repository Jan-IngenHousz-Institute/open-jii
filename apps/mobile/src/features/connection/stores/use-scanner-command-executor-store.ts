import { create } from "zustand";
import type { IMultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";
import { createMultispeqCommandExecutor } from "~/features/connection/services/scan-manager/utils/create-multispeq-command-executor";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

import { MULTISPEQ_CONSOLE } from "@repo/iot";

const log = createLogger("scanner-executor");

export interface DeviceExecutorEntry {
  device: Device;
  executor: IMultispeqCommandExecutor;
  isExecuting: boolean;
  isCancelled: boolean;
  error: Error | undefined;
  commandResponse: string | object | undefined;
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

  // Multi-device API
  addDevice: (device: Device) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  executeCommandOn: (deviceId: string, command: string | object) => Promise<string | object>;
  executeOnAll: (command: string | object) => Promise<DeviceCommandOutcome[]>;
  cancelCommandOn: (deviceId: string) => Promise<void>;
  cancelAll: () => Promise<void>;

  // Legacy single-device API: operates on the Primary device. setDevice keeps
  // its replace-all semantics — exactly the Bluetooth single-device behavior.
  setDevice: (device: Device | undefined) => Promise<void>;
  executeCommand: (command: string | object) => Promise<string | object | undefined>;
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
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    commandResponse: undefined,
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

  return {
    executors: new Map(),
    isInitializing: false,
    commandExecutor: undefined,
    commandResponse: undefined,
    isExecuting: false,
    isCancelled: false,
    error: undefined,

    addDevice: async (device: Device) => {
      const prior = get().executors.get(device.id);
      if (prior) {
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

    executeCommandOn: async (deviceId: string, command: string | object) => {
      const entry = get().executors.get(deviceId);
      if (!entry) {
        const error = new Error("Command executor not initialized. No device connected.");
        set({ error });
        throw error;
      }

      patchEntry(deviceId, { isExecuting: true, isCancelled: false, error: undefined });

      try {
        const result = await entry.executor.execute(command);
        if (get().executors.get(deviceId)?.isCancelled) {
          throw new Error("Measurement cancelled");
        }
        patchEntry(deviceId, { commandResponse: result, isExecuting: false, error: undefined });
        return result;
      } catch (err) {
        // If cancelCommandOn preempted this execute() the underlying executor
        // rejects with a "superseded" error — surface the user-facing reason
        // instead so callers see a coherent cancellation message.
        const error = get().executors.get(deviceId)?.isCancelled
          ? new Error("Measurement cancelled")
          : toError(err);
        patchEntry(deviceId, { error, isExecuting: false });
        throw error;
      }
    },

    executeOnAll: async (command: string | object) => {
      const entries = Array.from(get().executors.values());
      const settled = await Promise.allSettled(
        entries.map((entry) => get().executeCommandOn(entry.device.id, command)),
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
        await entry.executor.execute(MULTISPEQ_CONSOLE.CANCEL);
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
        // Replace-all: destroy every existing executor first.
        const existing = Array.from(get().executors.values());
        for (const entry of existing) {
          await destroyExecutor(entry.executor);
        }

        const next = new Map<string, DeviceExecutorEntry>();
        if (device) {
          const executor = await createMultispeqCommandExecutor(device);
          if (executor) {
            next.set(device.id, freshEntry(device, executor));
          }
        }

        setEntries(next);
        set({ isInitializing: false });
      } catch (error) {
        set({
          error: toError(error),
          isInitializing: false,
        });
      }
    },

    executeCommand: async (command: string | object) => {
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
      return get().executeCommandOn(primary.device.id, command);
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
        });
      });
      setEntries(next);
    },

    destroy: async () => {
      const entries = Array.from(get().executors.values());
      setEntries(new Map());
      await Promise.allSettled(entries.map((entry) => destroyExecutor(entry.executor)));
    },
  };
});
