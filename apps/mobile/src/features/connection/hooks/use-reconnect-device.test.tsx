// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";
import type { Device } from "~/shared/types/device";

import { mountSimulatedDevices } from "../services/simulated-device";
import { useDeviceConnectionStore } from "./use-device-connection-store";
import { useReconnectDevice } from "./use-reconnect-device";

const flow = vi.hoisted(() => ({
  current: undefined as StoreApi<{ experimentId: string }> | undefined,
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: {
    getState: () => flow.current?.getState() ?? { experimentId: "" },
    subscribe: (listener: () => void) => flow.current?.subscribe(listener) ?? (() => undefined),
  },
}));
vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { queryOptions: () => ({ queryKey: ["experiments", "related"] }) },
    },
  },
}));

const simulated: Device = {
  id: "simulated:multispeq",
  name: "Simulated MultispeQ",
  type: "simulated-device",
};
let client: QueryClient;
let unmountSimulation: () => void;

beforeEach(() => {
  flow.current = createStore(() => ({ experimentId: "demo" }));
  client = new QueryClient();
  client.setQueryData(
    ["experiments", "related"],
    [
      { id: "demo", organizationType: "demo" },
      { id: "ordinary", organizationType: "university" },
    ],
  );
  unmountSimulation = mountSimulatedDevices(client);
  useDeviceConnectionStore.getState().setLastConnectedDevice(simulated);
});
afterEach(() => {
  cleanup();
  unmountSimulation();
  client.clear();
  useDeviceConnectionStore.getState().setLastConnectedDevice(undefined);
});

describe("eligible remembered devices", () => {
  it("hides a remembered simulator when leaving a demo and restores it in a demo", () => {
    const { result } = renderHook(useReconnectDevice);
    expect(result.current).toEqual(simulated);

    act(() => flow.current?.setState({ experimentId: "ordinary" }));
    expect(result.current).toBeUndefined();
    act(() => flow.current?.setState({ experimentId: "" }));
    expect(result.current).toBeUndefined();
    act(() => flow.current?.setState({ experimentId: "demo" }));
    expect(result.current).toEqual(simulated);
  });

  it("hides a simulator restored from storage outside a demo", () => {
    flow.current?.setState({ experimentId: "ordinary" });
    useDeviceConnectionStore.getState().setLastConnectedDevice(undefined);
    const { result } = renderHook(useReconnectDevice);
    act(() => {
      useDeviceConnectionStore.getState().setLastConnectedDevice(simulated);
    });
    expect(result.current).toBeUndefined();
  });

  it("hides the simulated reconnect when experiment data is unavailable", () => {
    const { result } = renderHook(useReconnectDevice);
    expect(result.current).toEqual(simulated);
    act(() => client.removeQueries({ queryKey: ["experiments", "related"] }));
    expect(result.current).toBeUndefined();
  });

  it.each(["usb", "bluetooth-classic"] as const)(
    "keeps a remembered %s device available outside a demo",
    (type) => {
      const physical: Device = { id: "physical-device", type, name: "Field sensor" };
      useDeviceConnectionStore.getState().setLastConnectedDevice(physical);
      flow.current?.setState({ experimentId: "ordinary" });
      const { result } = renderHook(useReconnectDevice);
      expect(result.current).toEqual(physical);
    },
  );
});
