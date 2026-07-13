import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  CommandProgress,
  IMultispeqCommandExecutor,
} from "~/features/connection/services/multispeq-communication/driver-command-executor";
import type { Device } from "~/shared/types/device";

import { useScannerCommandExecutorStore } from "./use-scanner-command-executor-store";

// Replace the executor factory so the store never touches react-native or BT.
const createMultispeqCommandExecutor = vi.fn();
vi.mock(
  "~/features/connection/services/scan-manager/utils/create-multispeq-command-executor",
  () => ({
    createMultispeqCommandExecutor: (device: Device | undefined) =>
      createMultispeqCommandExecutor(device),
  }),
);

interface ExecuteCall {
  command: string | object;
  resolve: (data: object | string) => void;
  reject: (err: Error) => void;
}

interface ControllableExecutor extends IMultispeqCommandExecutor {
  /** All execute() calls in the order they were issued. */
  calls: ExecuteCall[];
  destroyCalls: () => number;
  cancelCalls: () => number;
  /** Push a progress event to the currently subscribed listener (if any). */
  emitProgress: (progress: CommandProgress) => void;
}

function createControllableExecutor(): ControllableExecutor {
  const calls: ExecuteCall[] = [];
  let destroyed = 0;
  let cancelled = 0;
  let progressListener: ((progress: CommandProgress) => void) | undefined;

  return {
    calls,
    execute(command: string | object) {
      return new Promise<object | string>((resolve, reject) => {
        calls.push({ command, resolve, reject });
      });
    },
    cancel() {
      cancelled++;
      // Mirror the real driver: aborting rejects the in-flight execute() with
      // "Command cancelled".
      calls[calls.length - 1]?.reject(new Error("Command cancelled"));
      return Promise.resolve();
    },
    onProgress(listener) {
      progressListener = listener;
      return () => {
        if (progressListener === listener) progressListener = undefined;
      };
    },
    destroy() {
      destroyed++;
      return Promise.resolve();
    },
    destroyCalls: () => destroyed,
    cancelCalls: () => cancelled,
    emitProgress: (progress) => progressListener?.(progress),
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
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
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

    it("tracks scan timing and mirrors executor progress, clearing it on settle", async () => {
      const exec = await attachExecutor();
      const command = [
        {
          v_arrays: [],
          set_repeats: 1,
          _protocol_set_: [{ pulses: [10], pulse_distance: [1000] }],
        },
      ];

      const pending = useScannerCommandExecutorStore.getState().executeCommand(command);

      const mid = useScannerCommandExecutorStore.getState();
      expect(typeof mid.scanStartedAt).toBe("number");
      expect(mid.estimatedMs).toBeGreaterThan(0);

      // The executor's progress is mirrored into the store verbatim.
      const progress: CommandProgress = {
        phase: "receiving",
        chunks: 3,
        bytes: 120,
        elapsedMs: 40,
        lastEventAt: 1_700_000_000_000,
      };
      exec.emitProgress(progress);
      expect(useScannerCommandExecutorStore.getState().progress).toEqual(progress);

      exec.calls[0].resolve({ ok: true });
      await expect(pending).resolves.toEqual({ ok: true });

      // progress is cleared on settle; timing lingers until the next run.
      const done = useScannerCommandExecutorStore.getState();
      expect(done.progress).toBeUndefined();
      expect(typeof done.scanStartedAt).toBe("number");
    });

    it("runs background commands transparently without touching scan UI state", async () => {
      const exec = await attachExecutor();

      const pending = useScannerCommandExecutorStore
        .getState()
        .executeCommand("battery", { background: true });

      // A background command (battery poll) must not flip any measurement-facing
      // state - otherwise it resets the elapsed timer / estimate mid-scan.
      const mid = useScannerCommandExecutorStore.getState();
      expect(mid.isExecuting).toBe(false);
      expect(mid.scanStartedAt).toBeUndefined();
      expect(mid.estimatedMs).toBeUndefined();

      // No progress subscription either - emissions are ignored.
      exec.emitProgress({ phase: "receiving", chunks: 1, bytes: 4, elapsedMs: 1, lastEventAt: 1 });
      expect(useScannerCommandExecutorStore.getState().progress).toBeUndefined();

      exec.calls[0].resolve("battery:88");
      await expect(pending).resolves.toBe("battery:88");

      const done = useScannerCommandExecutorStore.getState();
      expect(done.commandResponse).toBeUndefined();
      expect(done.error).toBeUndefined();
      expect(done.isExecuting).toBe(false);
    });

    it("propagates background command errors without surfacing a scan error", async () => {
      const exec = await attachExecutor();

      const pending = useScannerCommandExecutorStore
        .getState()
        .executeCommand("battery", { background: true })
        .catch((e: Error) => e);

      exec.calls[0].reject(new Error("Command timeout"));

      const err = await pending;
      expect((err as Error).message).toBe("Command timeout");
      // A failed battery poll must never show up as a measurement error.
      expect(useScannerCommandExecutorStore.getState().error).toBeUndefined();
      expect(useScannerCommandExecutorStore.getState().isExecuting).toBe(false);
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
    it("aborts the in-flight command via cancel() and surfaces 'Measurement cancelled'", async () => {
      const exec = await attachExecutor();

      // Start an in-flight measurement so cancelCommand has something to abort.
      const pendingScan = useScannerCommandExecutorStore.getState().executeCommand("command");

      const cancelPromise = useScannerCommandExecutorStore.getState().cancelCommand();

      const stateMidCancel = useScannerCommandExecutorStore.getState();
      expect(stateMidCancel.isCancelled).toBe(true);
      expect(stateMidCancel.isExecuting).toBe(false);

      // cancel() is a dedicated method - no second execute() is issued.
      expect(exec.cancelCalls()).toBe(1);
      expect(exec.calls).toHaveLength(1);
      expect(exec.calls[0]?.command).toBe("command");

      await expect(cancelPromise).resolves.toBeUndefined();

      // executeCommand must surface "Measurement cancelled" (NOT the raw
      // "Command cancelled") because cancelCommand set isCancelled=true.
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

    it("logs, sets store error, and rethrows when cancel fails", async () => {
      const exec = await attachExecutor();
      exec.cancel = () => Promise.reject(new Error("write to BT failed"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      await expect(useScannerCommandExecutorStore.getState().cancelCommand()).rejects.toThrow(
        "write to BT failed",
      );

      expect(useScannerCommandExecutorStore.getState().error?.message).toBe("write to BT failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send cancel command"),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
