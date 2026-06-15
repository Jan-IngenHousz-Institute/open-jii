import { create } from "zustand";
import type {
  CommandProgress,
  ExecuteOptions,
  IMultispeqCommandExecutor,
} from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { createMultispeqCommandExecutor } from "~/features/connection/services/scan-manager/utils/create-multispeq-command-executor";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

import { estimateProtocolDurationMs } from "@repo/iot";

const log = createLogger("scanner-executor");

interface ScannerCommandExecutorStore {
  commandExecutor: IMultispeqCommandExecutor | undefined;
  commandResponse: string | object | undefined;
  isExecuting: boolean;
  isCancelled: boolean;
  error: Error | undefined;
  isInitializing: boolean;

  /** Live progress of the in-flight command (final-response transfer). */
  progress: CommandProgress | undefined;
  /** Epoch ms when the current scan started — drives the elapsed-time UI. */
  scanStartedAt: number | undefined;
  /** Estimated protocol runtime (ms) for the in-flight command, if known. */
  estimatedMs: number | undefined;

  // Set the device and create/update the executor
  setDevice: (device: Device | undefined) => Promise<void>;

  // Execute a command (optionally overriding the response timeout)
  executeCommand: (
    command: string | object,
    options?: ExecuteOptions,
  ) => Promise<string | object | undefined>;

  // Send cancel command (-1+) to stop a running operation on the device
  cancelCommand: () => Promise<void>;

  // Reset state
  reset: () => void;

  // Cleanup
  destroy: () => Promise<void>;
}

export const useScannerCommandExecutorStore = create<ScannerCommandExecutorStore>((set, get) => ({
  commandExecutor: undefined,
  commandResponse: undefined,
  isExecuting: false,
  isCancelled: false,
  error: undefined,
  isInitializing: false,
  progress: undefined,
  scanStartedAt: undefined,
  estimatedMs: undefined,

  setDevice: async (device: Device | undefined) => {
    // Prevent concurrent calls
    if (get().isInitializing) {
      return;
    }

    set({ isInitializing: true });

    try {
      // Cleanup existing executor
      const currentExecutor = get().commandExecutor;
      if (currentExecutor) {
        await currentExecutor
          .destroy()
          .catch((e) => log.warn("executor destroy failed", { err: (e as Error)?.message }));
      }

      // Create new executor (or undefined if no device)
      const executor = await createMultispeqCommandExecutor(device);

      // Update state
      const updates: Partial<ScannerCommandExecutorStore> = {
        commandExecutor: executor,
        error: undefined,
        isInitializing: false,
      };

      // Reset execution state when device disconnects
      if (device === undefined) {
        updates.commandResponse = undefined;
        updates.isExecuting = false;
        updates.progress = undefined;
        updates.scanStartedAt = undefined;
        updates.estimatedMs = undefined;
      }

      set(updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error(String(error)),
        isInitializing: false,
      });
    }
  },

  executeCommand: async (command: string | object, options?: ExecuteOptions) => {
    const { commandExecutor, isInitializing } = get();
    if (isInitializing) {
      const error = new Error("Command executor is being initialized. Please wait.");
      set({ error, isExecuting: false });
      throw error;
    }
    if (!commandExecutor) {
      const error = new Error("Command executor not initialized. No device connected.");
      set({ error, isExecuting: false });
      throw error;
    }

    // Estimated runtime sizes the elapsed-time progress bar. Console commands
    // (plain strings) estimate to 0 → treated as indeterminate (no bar).
    const estimatedMs = estimateProtocolDurationMs(command) || undefined;
    set({
      isExecuting: true,
      isCancelled: false,
      error: undefined,
      progress: undefined,
      scanStartedAt: Date.now(),
      estimatedMs,
    });

    // Mirror live command progress into the store while this execute runs.
    const unsubscribe = commandExecutor.onProgress((progress) => set({ progress }));

    try {
      const result = await commandExecutor.execute(command, options);
      if (get().isCancelled) {
        throw new Error("Measurement cancelled");
      }
      set({ commandResponse: result, isExecuting: false, error: undefined });
      return result;
    } catch (err) {
      // If cancelCommand preempted this execute() the underlying executor
      // rejects with a "superseded" error — surface the user-facing reason
      // instead so callers see a coherent cancellation message.
      const error = get().isCancelled
        ? new Error("Measurement cancelled")
        : err instanceof Error
          ? err
          : new Error(String(err));
      set({ error, isExecuting: false });
      throw error;
    } finally {
      // Only the transfer indicator is cleared here; scanStartedAt/estimatedMs
      // linger so the bar reads "complete" until the flow navigates away, and
      // are overwritten by the next run (or cleared on reset/disconnect).
      unsubscribe();
      set({ progress: undefined });
    }
  },

  cancelCommand: async () => {
    set({ isCancelled: true, isExecuting: false });
    const { commandExecutor } = get();
    if (!commandExecutor) {
      return;
    }
    try {
      // Preemptively abort the in-flight command on the driver. This sends the
      // `-1+` cancel switch to the device and rejects the running execute() —
      // the in-flight executeCommand() then surfaces "Measurement cancelled".
      await commandExecutor.cancel();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error("Failed to send cancel command", { err: error.message });
      set({ error });
      throw error;
    }
  },

  reset: () => {
    set({
      commandResponse: undefined,
      error: undefined,
      isExecuting: false,
      isCancelled: false,
      progress: undefined,
      scanStartedAt: undefined,
      estimatedMs: undefined,
    });
  },

  destroy: async () => {
    const { commandExecutor } = get();
    if (commandExecutor) {
      await commandExecutor
        .destroy()
        .catch((e) => log.warn("executor destroy failed", { err: (e as Error)?.message }));
      set({
        commandExecutor: undefined,
        commandResponse: undefined,
        error: undefined,
        isExecuting: false,
      });
    }
  },
}));
