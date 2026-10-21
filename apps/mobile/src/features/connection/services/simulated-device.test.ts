import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

import { getDemoRecording } from "@repo/iot/simulation/recordings";

import {
  connectedSimulatedDevices,
  createSimulatedExecutor,
  mountSimulatedDevices,
  openSimulatedDevice,
  simulatedExperimentId,
} from "./simulated-device";

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

const device = {
  id: "simulated:multispeq",
  name: "Simulated MultispeQ",
  type: "simulated-device" as const,
};
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function setup(organizationType: unknown) {
  flow.current = createStore(() => ({ experimentId: "demo-experiment" }));
  const client = new QueryClient();
  client.setQueryData(["experiments", "related"], [{ id: "demo-experiment", organizationType }]);
  unmount = mountSimulatedDevices(client);
  return client;
}

describe("simulated mobile device", () => {
  it("is available in a release build without development flags, identifies and runs the recording", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubEnv("NODE_ENV", "production");
    setup("demo");
    expect(simulatedExperimentId()).toBe("demo-experiment");
    await openSimulatedDevice(device);
    const executor = await createSimulatedExecutor();
    try {
      expect(await executor.getIdentity()).toMatchObject({
        family: "multispeq",
        deviceId: device.id,
      });
      const recording = getDemoRecording("multispeq");
      expect(await executor.execute(recording.protocol)).toEqual(recording.measurement);
    } finally {
      await executor.destroy();
    }
  });
  it.each([undefined, null, "research", "education", "community"])(
    "rejects non-demo context %s even in development",
    async (type) => {
      vi.stubGlobal("__DEV__", true);
      setup(type);
      expect(simulatedExperimentId()).toBeUndefined();
      await expect(openSimulatedDevice(device)).rejects.toThrow("demo experiment");
    },
  );
  it("disconnects and rejects an existing executor after experiment navigation", async () => {
    setup("demo");
    await openSimulatedDevice(device);
    const executor = await createSimulatedExecutor();
    flow.current?.setState({ experimentId: "private-experiment" });
    expect(connectedSimulatedDevices()).toEqual([]);
    await expect(executor.execute(getDemoRecording("multispeq").protocol)).rejects.toThrow(
      "original demo experiment",
    );
    await executor.destroy();
  });
  it("fails closed when the experiment cache disappears or errors", async () => {
    const client = setup("demo");
    await openSimulatedDevice(device);
    client.removeQueries({ queryKey: ["experiments", "related"] });
    expect(simulatedExperimentId()).toBeUndefined();
    expect(connectedSimulatedDevices()).toEqual([]);
  });
});
