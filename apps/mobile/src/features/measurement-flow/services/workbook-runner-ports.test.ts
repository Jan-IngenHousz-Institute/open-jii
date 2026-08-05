import { describe, expect, it, vi } from "vitest";
import type { MultiScanRound } from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type { DeviceExecutorEntry } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import type { CommandRunInput, DeviceOutcome } from "@repo/workbook";

import { BroadcastUserGate, createMobileRunnerPorts } from "./workbook-runner-ports";

function device(id: string): Device {
  return { id, name: `Device ${id}`, type: "usb" };
}

function entry(value: Device): DeviceExecutorEntry {
  return {
    device: value,
    executor: {
      execute: vi.fn(),
      cancel: vi.fn(),
      destroy: vi.fn(),
      getIdentity: vi.fn(),
      onProgress: vi.fn(() => vi.fn()),
    },
    identity: {
      family: "multispeq",
      name: value.name,
      deviceId: `serial-${value.id}`,
      raw: {},
    },
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    commandResponse: undefined,
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
  };
}

function command(cellId: string, deviceIds: string[]): CommandRunInput {
  return {
    trackId: "main",
    cellId,
    command: cellId,
    family: "multispeq",
    source: { kind: "inlineCell", format: "string" },
    deviceIds,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function emptyMacroRunnerDeps(scanGate: BroadcastUserGate, analysisGate: BroadcastUserGate) {
  return {
    scanGate,
    analysisGate,
    getProtocolCode: () => null,
    getMacroMeta: () => null,
    cancelDevices: () => Promise.resolve(),
  };
}

describe("mobile workbook runner command port", () => {
  it("releases heterogeneous target subsets together and returns per-device outcomes", async () => {
    const scanGate = new BroadcastUserGate();
    const analysisGate = new BroadcastUserGate();
    const a = device("a");
    const b = device("b");
    const executors = new Map([
      [a.id, entry(a)],
      [b.id, entry(b)],
    ]);
    const first = deferred<MultiScanRound>();
    const second = deferred<MultiScanRound>();
    const executeAssignments = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let continuePartial = false;
    const ports = createMobileRunnerPorts({
      ...emptyMacroRunnerDeps(scanGate, analysisGate),
      getExecutors: () => executors,
      executeAssignments,
      shouldContinueAfterPartial: () => continuePartial,
    });

    const runA = ports.commandExecutor.execute(command("cell-a", ["a"]), {
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });
    const runB = ports.commandExecutor.execute(command("cell-b", ["b"]), {
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });
    expect(executeAssignments).not.toHaveBeenCalled();

    scanGate.arm();
    await Promise.resolve();
    expect(executeAssignments).toHaveBeenCalledTimes(2);
    expect(executeAssignments.mock.calls.map(([assignments]) => assignments[0].device.id)).toEqual([
      "a",
      "b",
    ]);

    first.resolve({ successes: [{ device: a, result: { value: 1 } }], failures: [] });
    second.resolve({ successes: [], failures: [{ device: b, error: new Error("unplugged") }] });

    await expect(runA).resolves.toEqual([
      {
        deviceId: "a",
        deviceLabel: "Device a",
        family: "multispeq",
        deviceName: "Device a",
        data: { value: 1 },
      },
    ] satisfies DeviceOutcome[]);
    await vi.waitFor(() => expect(scanGate.pending).toBe(true));
    continuePartial = true;
    scanGate.arm();
    await expect(runB).resolves.toEqual([
      {
        deviceId: "b",
        deviceLabel: "Device b",
        family: "multispeq",
        deviceName: "Device b",
        error: "unplugged",
      },
    ] satisfies DeviceOutcome[]);
  });

  it("cancels only the targeted subset and does not flatten missing devices", async () => {
    const scanGate = new BroadcastUserGate();
    const analysisGate = new BroadcastUserGate();
    const a = device("a");
    const executors = new Map([[a.id, entry(a)]]);
    const round = deferred<MultiScanRound>();
    const cancelDevices = vi.fn(() => Promise.resolve());
    const ports = createMobileRunnerPorts({
      ...emptyMacroRunnerDeps(scanGate, analysisGate),
      getExecutors: () => executors,
      executeAssignments: () => round.promise,
      cancelDevices,
    });
    const abort = new AbortController();
    const running = ports.commandExecutor.execute(command("cell-a", ["a", "missing"]), {
      signal: abort.signal,
      onProgress: vi.fn(),
    });
    scanGate.arm();
    await Promise.resolve();
    abort.abort();
    expect(cancelDevices).toHaveBeenCalledWith(["a", "missing"]);

    round.resolve({
      successes: [{ device: a, result: { ok: true } }],
      failures: [{ device: device("missing"), error: new Error("not initialized") }],
    });
    await expect(running).rejects.toThrow("Measurement cancelled");
  });

  it("accumulates successes and retries only the failed devices", async () => {
    const scanGate = new BroadcastUserGate();
    const analysisGate = new BroadcastUserGate();
    const a = device("a");
    const b = device("b");
    const executors = new Map([[a.id, entry(a)]]);
    const executeAssignments = vi
      .fn()
      .mockResolvedValueOnce({
        successes: [{ device: a, result: { value: 1 } }],
        failures: [{ device: b, error: new Error("not initialized") }],
      })
      .mockResolvedValueOnce({
        successes: [{ device: b, result: { value: 2 } }],
        failures: [],
      });
    const ports = createMobileRunnerPorts({
      ...emptyMacroRunnerDeps(scanGate, analysisGate),
      getExecutors: () => executors,
      executeAssignments,
    });
    const running = ports.commandExecutor.execute(command("cell-a", ["a", "b"]), {
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });

    scanGate.arm();
    await vi.waitFor(() => expect(scanGate.pending).toBe(true));
    executors.set(b.id, entry(b));
    scanGate.arm();

    await expect(running).resolves.toEqual([
      expect.objectContaining({ deviceId: "a", data: { value: 1 } }),
      expect.objectContaining({ deviceId: "b", data: { value: 2 } }),
    ]);
    expect(executeAssignments).toHaveBeenCalledTimes(2);
    expect(executeAssignments.mock.calls[0]?.[0].map(({ device }) => device.id)).toEqual(["a"]);
    expect(executeAssignments.mock.calls[1]?.[0].map(({ device }) => device.id)).toEqual(["b"]);
  });
});
