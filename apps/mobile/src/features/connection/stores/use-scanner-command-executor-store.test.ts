import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IMultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";
import type { Device } from "~/shared/types/device";

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

      const pendingA = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-a", "protocol");
      const pendingB = useScannerCommandExecutorStore
        .getState()
        .executeCommandOn("usb-b", "protocol");

      const cancelPromise = useScannerCommandExecutorStore.getState().cancelAll();

      // Per device: original protocol + the cancel write.
      expect(execA.calls.map((c) => c.command)).toEqual(["protocol", "-1+"]);
      expect(execB.calls.map((c) => c.command)).toEqual(["protocol", "-1+"]);

      execA.calls[0].reject(new Error("Superseded by new execute call"));
      execB.calls[0].reject(new Error("Superseded by new execute call"));
      execA.calls[1].resolve({ cancelled: true });
      execB.calls[1].resolve({ cancelled: true });

      await cancelPromise;
      await expect(pendingA).rejects.toThrow("Measurement cancelled");
      await expect(pendingB).rejects.toThrow("Measurement cancelled");
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
