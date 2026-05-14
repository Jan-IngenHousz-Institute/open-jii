import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IMultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import type { Device } from "~/types/device";

import { useScannerCommandExecutorStore } from "./use-scanner-command-executor-store";

// `@repo/iot` pulls in driver code we don't need at unit-test time — stub the
// only constant the store reads.
vi.mock("@repo/iot", () => ({
  MULTISPEQ_CONSOLE: {
    CANCEL: "-1+",
  },
}));

// Replace the executor factory so the store never touches react-native or BT.
const createMultispeqCommandExecutor = vi.fn();
vi.mock("~/services/scan-manager/utils/create-multispeq-command-executor", () => ({
  createMultispeqCommandExecutor: (device: Device | undefined) =>
    createMultispeqCommandExecutor(device),
}));

interface ExecuteCall {
  command: string | object;
  resolve: (data: object | string) => void;
  reject: (err: Error) => void;
}

interface ControllableExecutor extends IMultispeqCommandExecutor {
  /** All execute() calls in the order they were issued. */
  calls: ExecuteCall[];
  destroyCalls: () => number;
}

function createControllableExecutor(): ControllableExecutor {
  const calls: ExecuteCall[] = [];
  let destroyed = 0;

  return {
    calls,
    execute(command: string | object) {
      return new Promise<object | string>((resolve, reject) => {
        calls.push({ command, resolve, reject });
      });
    },
    destroy() {
      destroyed++;
      return Promise.resolve();
    },
    destroyCalls: () => destroyed,
  };
}

const FAKE_DEVICE: Device = { type: "bluetooth-classic", name: "fake", id: "fake-id" };

async function attachExecutor(): Promise<ControllableExecutor> {
  const exec = createControllableExecutor();
  createMultispeqCommandExecutor.mockResolvedValueOnce(exec);
  await useScannerCommandExecutorStore.getState().setDevice(FAKE_DEVICE);
  return exec;
}

function resetStore() {
  useScannerCommandExecutorStore.setState({
    commandExecutor: undefined,
    commandResponse: undefined,
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    isInitializing: false,
  });
}

describe("useScannerCommandExecutorStore", () => {
  beforeEach(() => {
    createMultispeqCommandExecutor.mockReset();
    resetStore();
  });

  describe("executeCommand", () => {
    it("resolves with the executor result and clears execution state", async () => {
      const exec = await attachExecutor();

      const pending = useScannerCommandExecutorStore.getState().executeCommand("hello");
      expect(useScannerCommandExecutorStore.getState().isExecuting).toBe(true);
      expect(exec.calls[0]?.command).toBe("hello");

      exec.calls[0].resolve({ ok: true });
      await expect(pending).resolves.toEqual({ ok: true });

      const state = useScannerCommandExecutorStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.commandResponse).toEqual({ ok: true });
      expect(state.error).toBeUndefined();
    });

    it("throws and sets error when no executor is attached", async () => {
      await expect(
        useScannerCommandExecutorStore.getState().executeCommand("hello"),
      ).rejects.toThrow("Command executor not initialized");
      expect(useScannerCommandExecutorStore.getState().error?.message).toMatch(
        "Command executor not initialized",
      );
    });

    it("propagates underlying executor errors verbatim when not cancelled", async () => {
      const exec = await attachExecutor();
      const pending = useScannerCommandExecutorStore.getState().executeCommand("hello");

      exec.calls[0].reject(new Error("BT write failed"));

      await expect(pending).rejects.toThrow("BT write failed");
      expect(useScannerCommandExecutorStore.getState().error?.message).toBe("BT write failed");
      expect(useScannerCommandExecutorStore.getState().isExecuting).toBe(false);
    });
  });

  describe("cancelCommand", () => {
    it("sends MULTISPEQ_CONSOLE.CANCEL and surfaces 'Measurement cancelled' to the in-flight executeCommand", async () => {
      const exec = await attachExecutor();

      // Start an in-flight measurement so cancelCommand has something to abort.
      const pendingScan = useScannerCommandExecutorStore.getState().executeCommand("protocol");

      const cancelPromise = useScannerCommandExecutorStore.getState().cancelCommand();

      const stateMidCancel = useScannerCommandExecutorStore.getState();
      expect(stateMidCancel.isCancelled).toBe(true);
      expect(stateMidCancel.isExecuting).toBe(false);

      // Two execute() calls: the original protocol + the cancel.
      expect(exec.calls).toHaveLength(2);
      expect(exec.calls[0]?.command).toBe("protocol");
      expect(exec.calls[1]?.command).toBe("-1+");

      // The real executor preempts the in-flight call with "Superseded by new
      // execute call" when a follow-up execute() arrives. Mirror that here.
      exec.calls[0].reject(new Error("Superseded by new execute call"));
      exec.calls[1].resolve({ cancelled: true });

      await expect(cancelPromise).resolves.toBeUndefined();

      // executeCommand must surface "Measurement cancelled" (NOT "Superseded")
      // because cancelCommand set isCancelled=true before the preemption fired.
      await expect(pendingScan).rejects.toThrow("Measurement cancelled");
      expect(useScannerCommandExecutorStore.getState().error?.message).toBe(
        "Measurement cancelled",
      );
    });

    it("is a no-op (resolves) when no executor is attached", async () => {
      await expect(
        useScannerCommandExecutorStore.getState().cancelCommand(),
      ).resolves.toBeUndefined();

      expect(useScannerCommandExecutorStore.getState().isCancelled).toBe(true);
      expect(useScannerCommandExecutorStore.getState().isExecuting).toBe(false);
      expect(useScannerCommandExecutorStore.getState().error).toBeUndefined();
    });

    it("logs, sets store error, and rethrows when the cancel write fails", async () => {
      const exec = await attachExecutor();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const cancelPromise = useScannerCommandExecutorStore.getState().cancelCommand();
      exec.calls[0].reject(new Error("write to BT failed"));

      await expect(cancelPromise).rejects.toThrow("write to BT failed");

      expect(useScannerCommandExecutorStore.getState().error?.message).toBe("write to BT failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to send cancel command",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
