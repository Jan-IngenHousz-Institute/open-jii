import type { QueryClient } from "@tanstack/react-query";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { orpc } from "~/shared/api/orpc";
import type { Device } from "~/shared/types/device";

import { listItems } from "@repo/api/shared/listing";
import { simulatedSensorsEnabled } from "@repo/api/transforms/simulated-sensor-eligibility";
import { simulatedDeviceId } from "@repo/iot/simulation/recordings";
import { SimulatedTransportAdapter } from "@repo/iot/simulation/transport";

import { connectionKeys } from "./connection-keys";
import type { DeviceCommandExecutor } from "./device-command-executor";
import { createIdentifiedCommandExecutor } from "./identified-command-executor";

let client: QueryClient | undefined;
let connected: { device: Device; experimentId: string } | undefined;
const listeners = new Set<() => void>();

export function simulatedExperimentId(): string | undefined {
  const id = useMeasurementFlowStore.getState().experimentId;
  if (!client || !id) return undefined;
  const query = orpc.experiments.listExperiments.queryOptions({ input: { scope: "related" } });
  const state = client.getQueryState(query.queryKey);
  if (state?.error || state?.status !== "success") return undefined;
  const experiment = listItems(client.getQueryData(query.queryKey)).find(
    (entry) => entry.id === id,
  );
  return simulatedSensorsEnabled(experiment) ? id : undefined;
}

export function subscribeSimulatedExperiment(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mountSimulatedDevices(queryClient: QueryClient): () => void {
  client = queryClient;
  const refresh = () => {
    if (connected && connected.experimentId !== simulatedExperimentId()) {
      connected = undefined;
      void queryClient.invalidateQueries({ queryKey: connectionKeys.connectedDevices });
    }
    for (const listener of listeners) listener();
  };
  const unsubscribeFlow = useMeasurementFlowStore.subscribe(refresh);
  const unsubscribeQueries = queryClient.getQueryCache().subscribe(refresh);
  refresh();
  return () => {
    unsubscribeFlow();
    unsubscribeQueries();
    client = undefined;
    connected = undefined;
    for (const listener of listeners) listener();
  };
}

export function openSimulatedDevice(device: Device): Promise<void> {
  const experimentId = simulatedExperimentId();
  if (!experimentId || device.id !== simulatedDeviceId("multispeq")) {
    return Promise.reject(new Error("Simulated sensors require a demo experiment"));
  }
  connected = { device, experimentId };
  return Promise.resolve();
}

export function closeSimulatedDevice(): void {
  connected = undefined;
}

export function connectedSimulatedDevices(): Device[] {
  return connected && connected.experimentId === simulatedExperimentId() ? [connected.device] : [];
}

export async function createSimulatedExecutor(): Promise<DeviceCommandExecutor> {
  const experimentId = simulatedExperimentId();
  if (!experimentId || connected?.experimentId !== experimentId) {
    throw new Error("Simulated sensors require a demo experiment");
  }
  const executor = createIdentifiedCommandExecutor(new SimulatedTransportAdapter("multispeq"));
  const check = () => {
    if (simulatedExperimentId() !== experimentId || connected?.experimentId !== experimentId) {
      throw new Error("Simulated sensors require the original demo experiment");
    }
  };
  try {
    await executor.getIdentity();
    check();
  } catch (error) {
    await executor.destroy();
    throw error;
  }
  return {
    async execute(command, options) {
      check();
      const result = await executor.execute(command, options);
      check();
      return result;
    },
    cancel: () => executor.cancel(),
    async getIdentity() {
      check();
      return { ...(await executor.getIdentity()), deviceId: simulatedDeviceId("multispeq") };
    },
    onProgress: (listener) => executor.onProgress(listener),
    destroy: () => executor.destroy(),
  };
}
