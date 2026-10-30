import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

import { getDemoRecording } from "@repo/iot/simulation/recordings";

import * as identifiedExecutors from "./identified-command-executor";
import {
  closeSimulatedDevice,
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
  vi.restoreAllMocks();
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
  it("closes the session and refuses executor creation until reopened", async () => {
    setup("demo");
    await expect(createSimulatedExecutor()).rejects.toThrow("demo experiment");
    await openSimulatedDevice(device);
    closeSimulatedDevice();
    expect(connectedSimulatedDevices()).toEqual([]);
    await expect(createSimulatedExecutor()).rejects.toThrow("demo experiment");
  });

  it("destroys an executor whose identification handshake fails", async () => {
    setup("demo");
    await openSimulatedDevice(device);
    const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    vi.spyOn(identifiedExecutors, "createIdentifiedCommandExecutor").mockReturnValue({
      execute: vi.fn(),
      cancel: vi.fn(),
      getIdentity: vi.fn().mockRejectedValue(new Error("Invalid handshake")),
      onProgress: () => () => undefined,
      destroy,
    });
    await expect(createSimulatedExecutor()).rejects.toThrow("Invalid handshake");
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("delegates progress and cancels an in-flight recording without poisoning the next run", async () => {
    setup("demo");
    await openSimulatedDevice(device);
    const executor = await createSimulatedExecutor();
    const progress = vi.fn();
    const unsubscribe = executor.onProgress(progress);
    const command = getDemoRecording("multispeq").protocol;
    try {
      const pending = executor.execute(command).catch((error: unknown) => error);
      await vi.waitFor(() => expect(progress).toHaveBeenCalled());
      await executor.cancel();
      await expect(pending).resolves.toMatchObject({ message: "Command cancelled" });
      unsubscribe();
      progress.mockClear();
      await expect(executor.execute(command)).resolves.toEqual(
        getDemoRecording("multispeq").measurement,
      );
      expect(progress).not.toHaveBeenCalled();
    } finally {
      await executor.destroy();
    }
  });

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
    await expect(openSimulatedDevice(device)).rejects.toThrow("demo experiment");
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
