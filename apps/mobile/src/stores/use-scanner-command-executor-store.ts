import { create } from "zustand";
import type { IMultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { createMultispeqCommandExecutor } from "~/services/scan-manager/utils/create-multispeq-command-executor";
import type { Device } from "~/types/device";

import { MULTISPEQ_CONSOLE } from "@repo/iot";

interface ScannerCommandExecutorStore {
  commandExecutor: IMultispeqCommandExecutor | undefined;
  commandResponse: string | object | undefined;
  isExecuting: boolean;
  isCancelled: boolean;
  error: Error | undefined;
  isInitializing: boolean;

  // Set the device and create/update the executor
  setDevice: (device: Device | undefined) => Promise<void>;

  // Execute a command
  executeCommand: (command: string | object) => Promise<string | object | undefined>;

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
        await currentExecutor.destroy().catch(console.error);
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
      }

      set(updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error(String(error)),
        isInitializing: false,
      });
    }
  },

  executeCommand: async (command: string | object) => {
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

    set({ isExecuting: true, isCancelled: false, error: undefined });

    try {
      const result = await commandExecutor.execute(command);
      if (get().isCancelled) {
        throw new Error("Measurement cancelled");
      }
      set({ commandResponse: result, isExecuting: false, error: undefined });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, isExecuting: false });
      throw error;
    }
  },

  cancelCommand: async () => {
    set({ isCancelled: true, isExecuting: false });
    const { commandExecutor } = get();
    if (commandExecutor) {
      await commandExecutor.execute(MULTISPEQ_CONSOLE.CANCEL);
    }
  },

  reset: () => {
    set({ commandResponse: undefined, error: undefined, isExecuting: false, isCancelled: false });
  },

  destroy: async () => {
    const { commandExecutor } = get();
    if (commandExecutor) {
      await commandExecutor.destroy().catch(console.error);
      set({
        commandExecutor: undefined,
        commandResponse: undefined,
        error: undefined,
        isExecuting: false,
      });
    }
  },
}));
