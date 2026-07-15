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
const USB_DEVICE_A: Device = { type: "usb", name: "MultispeQ A", id: "usb-a" };
const USB_DEVICE_B: Device = { type: "usb", name: "MultispeQ B", id: "usb-b" };

async function attachExecutor(): Promise<ControllableExecutor> {
  const exec = createControllableExecutor();
  createMultispeqCommandExecutor.mockResolvedValueOnce(exec);
  await useScannerCommandExecutorStore.getState().setDevice(FAKE_DEVICE);
  return exec;
}

async function addExecutorFor(device: Device): Promise<ControllableExecutor> {
  const exec = createControllableExecutor();
  createMultispeqCommandExecutor.mockResolvedValueOnce(exec);
  await useScannerCommandExecutorStore.getState().addDevice(device);
  return exec;
}

function resetStore() {
  useScannerCommandExecutorStore.setState({
    executors: new Map(),
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
      const protocol = [
        {
          v_arrays: [],
          set_repeats: 1,
          _protocol_set_: [{ pulses: [10], pulse_distance: [1000] }],
        },
      ];

      const pending = useScannerCommandExecutorStore.getState().executeCommand(protocol);

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
      // state, otherwise it resets the elapsed timer / estimate mid-scan.
      const mid = useScannerCommandExecutorStore.getState();
      expect(mid.isExecuting).toBe(false);
      expect(mid.scanStartedAt).toBeUndefined();
      expect(mid.estimatedMs).toBeUndefined();

      // No progress subscription either; emissions are ignored.
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
      const pendingScan = useScannerCommandExecutorStore.getState().executeCommand("protocol");

      const cancelPromise = useScannerCommandExecutorStore.getState().cancelCommand();

      const stateMidCancel = useScannerCommandExecutorStore.getState();
      expect(stateMidCancel.isCancelled).toBe(true);
      expect(stateMidCancel.isExecuting).toBe(false);

      // cancel() is a dedicated method; no second execute() is issued.
      expect(exec.cancelCalls()).toBe(1);
      expect(exec.calls).toHaveLength(1);
      expect(exec.calls[0]?.command).toBe("protocol");

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

  describe("multi-device", () => {
    it("addDevice keeps existing entries (add, not replace)", async () => {
      await addExecutorFor(USB_DEVICE_A);
      await addExecutorFor(USB_DEVICE_B);

      const { executors } = useScannerCommandExecutorStore.getState();
      expect(Array.from(executors.keys())).toEqual(["usb-a", "usb-b"]);
    });

    it("legacy mirrors track the primary (first) device", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      await addExecutorFor(USB_DEVICE_B);

      const pendingA = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-a", "protocol");
      execA.calls[0].resolve({ from: "a" });
      await pendingA;

      const state = useScannerCommandExecutorStore.getState();
      expect(state.commandExecutor).toBe(execA);
      expect(state.commandResponse).toEqual({ from: "a" });
    });

    it("executeOnAll settles devices independently (one rejects, one resolves)", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      const execB = await addExecutorFor(USB_DEVICE_B);

      const pending = useScannerCommandExecutorStore.getState().executeOnAll("protocol");
      execA.calls[0].reject(new Error("device A unplugged"));
      execB.calls[0].resolve({ from: "b" });

      const outcomes = await pending;
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0]).toMatchObject({
        device: USB_DEVICE_A,
        status: "rejected",
        error: new Error("device A unplugged"),
      });
      expect(outcomes[1]).toMatchObject({
        device: USB_DEVICE_B,
        status: "fulfilled",
        result: { from: "b" },
      });

      // Per-device state: only A carries the error.
      const { executors } = useScannerCommandExecutorStore.getState();
      expect(executors.get("usb-a")?.error?.message).toBe("device A unplugged");
      expect(executors.get("usb-b")?.error).toBeUndefined();
      expect(executors.get("usb-b")?.commandResponse).toEqual({ from: "b" });
    });

    it("removeDevice mid-execute rejects only that device and destroys its executor", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      const execB = await addExecutorFor(USB_DEVICE_B);

      const pendingA = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-a", "protocol");
      const pendingB = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-b", "protocol");

      await useScannerCommandExecutorStore.getState().removeDevice("usb-a");
      expect(execA.destroyCalls()).toBe(1);
      // Removal deletes the entry; the in-flight call surfaces the executor's
      // rejection (the real MultispeqCommandExecutor rejects on destroy()).
      execA.calls[0].reject(new Error("Executor destroyed"));
      await expect(pendingA).rejects.toThrow("Executor destroyed");

      execB.calls[0].resolve({ from: "b" });
      await expect(pendingB).resolves.toEqual({ from: "b" });

      const { executors } = useScannerCommandExecutorStore.getState();
      expect(executors.has("usb-a")).toBe(false);
      expect(executors.get("usb-b")?.commandResponse).toEqual({ from: "b" });
    });

    it("cancelAll cancels every in-flight device", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      const execB = await addExecutorFor(USB_DEVICE_B);

      // Attach handlers immediately: the driver-level cancel() rejects the
      // in-flight execute synchronously, which vitest would otherwise flag
      // as an unhandled rejection before the assertions below run.
      const pendingA = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-a", "protocol")
        .catch((e: Error) => e);
      const pendingB = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-b", "protocol")
        .catch((e: Error) => e);

      await useScannerCommandExecutorStore.getState().cancelAll();

      // Cancel goes through the driver's preemptive cancel(), not an extra
      // device write; the in-flight execute rejects and surfaces as a
      // coherent cancellation.
      expect(execA.cancelCalls()).toBe(1);
      expect(execB.cancelCalls()).toBe(1);
      expect(execA.calls.map((c) => c.command)).toEqual(["protocol"]);
      expect(execB.calls.map((c) => c.command)).toEqual(["protocol"]);

      await expect(pendingA).resolves.toMatchObject({ message: "Measurement cancelled" });
      await expect(pendingB).resolves.toMatchObject({ message: "Measurement cancelled" });
    });

    it("addDevice replaces (and destroys) a prior executor for the same device", async () => {
      const stale = await addExecutorFor(USB_DEVICE_A);
      const fresh = await addExecutorFor(USB_DEVICE_A);

      expect(stale.destroyCalls()).toBe(1);
      expect(fresh.destroyCalls()).toBe(0);
      expect(useScannerCommandExecutorStore.getState().executors.size).toBe(1);
    });

    it("addDevice records the error when the executor factory throws", async () => {
      createMultispeqCommandExecutor.mockRejectedValueOnce(new Error("no permission"));

      await useScannerCommandExecutorStore.getState().addDevice(USB_DEVICE_A);

      const state = useScannerCommandExecutorStore.getState();
      expect(state.executors.size).toBe(0);
      expect(state.error?.message).toBe("no permission");
    });

    it("addDevice is a no-op when the factory yields no executor", async () => {
      createMultispeqCommandExecutor.mockResolvedValueOnce(undefined);

      await useScannerCommandExecutorStore.getState().addDevice(USB_DEVICE_A);

      expect(useScannerCommandExecutorStore.getState().executors.size).toBe(0);
    });

    it("removeDevice and cancelCommandOn ignore unknown device ids", async () => {
      await useScannerCommandExecutorStore.getState().removeDevice("ghost");
      await useScannerCommandExecutorStore.getState().cancelCommandOn("ghost");
      expect(useScannerCommandExecutorStore.getState().executors.size).toBe(0);
    });

    it("executeCommandOn rejects when the device is not connected", async () => {
      await expect(
        useScannerCommandExecutorStore.getState().executeCommandOn("ghost", "hello"),
      ).rejects.toThrow("Command executor not initialized");
      expect(useScannerCommandExecutorStore.getState().error?.message).toContain("not initialized");
    });

    it("cancelCommandOn surfaces a failing driver cancel as the entry's error", async () => {
      const exec = await addExecutorFor(USB_DEVICE_A);
      exec.cancel = () => Promise.reject(new Error("cancel write failed"));

      await expect(
        useScannerCommandExecutorStore.getState().cancelCommandOn("usb-a"),
      ).rejects.toThrow("cancel write failed");
      expect(useScannerCommandExecutorStore.getState().executors.get("usb-a")?.error?.message).toBe(
        "cancel write failed",
      );
    });

    it("setDevice records the error when the executor factory throws", async () => {
      createMultispeqCommandExecutor.mockRejectedValueOnce(new Error("bluetooth off"));

      await useScannerCommandExecutorStore.getState().setDevice(FAKE_DEVICE);

      const state = useScannerCommandExecutorStore.getState();
      expect(state.error?.message).toBe("bluetooth off");
      expect(state.isInitializing).toBe(false);
    });

    it("executeCommand rejects while a setDevice is still initializing", async () => {
      useScannerCommandExecutorStore.setState({ isInitializing: true });

      await expect(
        useScannerCommandExecutorStore.getState().executeCommand("hello"),
      ).rejects.toThrow("being initialized");
    });

    it("executeCommand rejects when no device is connected", async () => {
      await expect(
        useScannerCommandExecutorStore.getState().executeCommand("hello"),
      ).rejects.toThrow("not initialized");
    });

    it("cancelCommand without a primary device just flags cancellation", async () => {
      await useScannerCommandExecutorStore.getState().cancelCommand();

      const state = useScannerCommandExecutorStore.getState();
      expect(state.isCancelled).toBe(true);
      expect(state.isExecuting).toBe(false);
    });

    it("destroy empties the registry and destroys every executor", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      const execB = await addExecutorFor(USB_DEVICE_B);

      await useScannerCommandExecutorStore.getState().destroy();

      expect(useScannerCommandExecutorStore.getState().executors.size).toBe(0);
      expect(execA.destroyCalls()).toBe(1);
      expect(execB.destroyCalls()).toBe(1);
    });

    it("legacy setDevice replaces all entries (Bluetooth replace-all semantics)", async () => {
      const execA = await addExecutorFor(USB_DEVICE_A);
      const execB = await addExecutorFor(USB_DEVICE_B);

      const execBt = createControllableExecutor();
      createMultispeqCommandExecutor.mockResolvedValueOnce(execBt);
      await useScannerCommandExecutorStore.getState().setDevice(FAKE_DEVICE);

      expect(execA.destroyCalls()).toBe(1);
      expect(execB.destroyCalls()).toBe(1);
      const { executors } = useScannerCommandExecutorStore.getState();
      expect(Array.from(executors.keys())).toEqual(["fake-id"]);
    });
  });
});
