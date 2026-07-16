// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { DeviceExecutorEntry } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import { useMultiScanner } from "./use-multi-scanner";

vi.mock(
  "~/features/connection/services/scan-manager/utils/create-multispeq-command-executor",
  () => ({ createMultispeqCommandExecutor: vi.fn() }),
);

const DEVICE_A: Device = { id: "usb-a", type: "usb", name: "MultispeQ #1" };
const DEVICE_B: Device = { id: "usb-b", type: "usb", name: "MultispeQ #2" };
const PROTOCOL = { code: [{ _protocol_set_: [] }] };

interface Round {
  successes: { device: Device; result: object }[];
  failures: { device: Device; error: Error }[];
}

function entry(device: Device, patch: Partial<DeviceExecutorEntry> = {}): DeviceExecutorEntry {
  return {
    device,
    executor: {
      execute: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      getIdentity: vi.fn().mockResolvedValue({ family: "multispeq", raw: {} }),
      onProgress: vi.fn(() => () => undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    },
    identity: undefined,
    isExecuting: false,
    isCancelled: false,
    error: undefined,
    commandResponse: undefined,
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
    ...patch,
  };
}

function setEntries(entries: DeviceExecutorEntry[]) {
  useScannerCommandExecutorStore.setState({
    executors: new Map(entries.map((e) => [e.device.id, e])),
  });
}

// Pristine store snapshot: tests override actions (executeCommandOn, reset,
// cancelAll) via setState, so each test must start from the real implementation
// rather than whatever the previous test left behind.
const initialStoreState = useScannerCommandExecutorStore.getState();

describe("useMultiScanner", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient();
    useScannerCommandExecutorStore.setState({ ...initialStoreState, executors: new Map() }, true);
  });

  it("maps executor entries to per-device scan statuses", () => {
    setEntries([
      entry(DEVICE_A, { isExecuting: true }),
      entry(DEVICE_B, { error: new Error("boom") }),
      entry({ id: "usb-c", type: "usb", name: "MultispeQ #3" }, { commandResponse: { ok: 1 } }),
      entry({ id: "usb-d", type: "usb", name: "MultispeQ #4" }),
    ]);

    const { result } = renderHook(() => useMultiScanner(), { wrapper });

    expect(result.current.deviceStates.map((s) => s.status)).toEqual([
      "scanning",
      "error",
      "done",
      "idle",
    ]);
  });

  it("partitions per-device outcomes and patches each device's battery cache", async () => {
    setEntries([entry(DEVICE_A), entry(DEVICE_B)]);
    const executeCommandOn = vi
      .fn()
      .mockResolvedValueOnce({ device_id: "mock-a", device_battery: 81 })
      .mockRejectedValueOnce(new Error("Mock device failure (simulated)"));
    useScannerCommandExecutorStore.setState({ executeCommandOn });

    const { result } = renderHook(() => useMultiScanner(), { wrapper });

    let round: Round | undefined;
    await act(async () => {
      round = await result.current.executeScanAll(PROTOCOL, [DEVICE_A, DEVICE_B]);
    });

    expect(round?.successes).toEqual([
      { device: DEVICE_A, result: { device_id: "mock-a", device_battery: 81 } },
    ]);
    expect(round?.failures.map((f) => f.error.message)).toEqual([
      "Mock device failure (simulated)",
    ]);
    expect(client.getQueryData(connectionKeys.battery(DEVICE_A.id))).toBe(81);
    expect(client.getQueryData(connectionKeys.battery(DEVICE_B.id))).toBeUndefined();
  });

  it("runs each assignment's own command; devices without one sit the round out", async () => {
    setEntries([entry(DEVICE_A), entry(DEVICE_B)]);
    const executeCommandOn = vi.fn().mockResolvedValue({ ok: 1 });
    useScannerCommandExecutorStore.setState({ executeCommandOn });

    const { result } = renderHook(() => useMultiScanner(), { wrapper });

    const commandA = [{ _protocol_set_: [{ v: "a" }] }];
    let round: Round | undefined;
    await act(async () => {
      round = await result.current.executeScanAssignments([
        { device: DEVICE_A, command: commandA, protocolId: "proto-a", protocolName: "A" },
      ]);
    });

    expect(executeCommandOn).toHaveBeenCalledTimes(1);
    expect(executeCommandOn).toHaveBeenCalledWith(DEVICE_A.id, commandA);
    expect(round?.successes.map((s) => s.device.id)).toEqual([DEVICE_A.id]);
    expect(round?.failures).toEqual([]);
  });

  it("merges pre-resolved failures into the round without touching the devices", async () => {
    setEntries([entry(DEVICE_A), entry(DEVICE_B)]);
    const executeCommandOn = vi.fn().mockResolvedValue({ device_battery: 55 });
    useScannerCommandExecutorStore.setState({ executeCommandOn });

    const { result } = renderHook(() => useMultiScanner(), { wrapper });

    let round: Round | undefined;
    await act(async () => {
      round = await result.current.executeScanAssignments(
        [{ device: DEVICE_A, command: "battery" }],
        [{ device: DEVICE_B, error: new Error("Protocol code is unavailable") }],
      );
    });

    expect(executeCommandOn).toHaveBeenCalledTimes(1);
    expect(round?.successes.map((s) => s.device.id)).toEqual([DEVICE_A.id]);
    expect(round?.failures).toEqual([
      { device: DEVICE_B, error: new Error("Protocol code is unavailable") },
    ]);
    // Battery patching applies to assignment rounds too.
    expect(client.getQueryData(connectionKeys.battery(DEVICE_A.id))).toBe(55);
  });

  it("returns an empty round without devices", async () => {
    const { result } = renderHook(() => useMultiScanner(), { wrapper });

    let round: Round | undefined;
    await act(async () => {
      round = await result.current.executeScanAll(PROTOCOL, []);
    });

    expect(round).toEqual({ successes: [], failures: [] });
  });

  it("cancelAll and reset delegate to the executor store", async () => {
    const cancelAll = vi.fn().mockResolvedValue(undefined);
    const reset = vi.fn();
    useScannerCommandExecutorStore.setState({ cancelAll, reset });

    const { result } = renderHook(() => useMultiScanner(), { wrapper });
    await act(async () => {
      await result.current.cancelAll();
      result.current.reset();
    });

    expect(cancelAll).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});
