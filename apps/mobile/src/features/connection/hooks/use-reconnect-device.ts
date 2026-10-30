import { useDeviceConnectionStore } from "./use-device-connection-store";
import { useSimulatedExperiment } from "./use-simulated-experiment";

export function useReconnectDevice() {
  const lastConnectedDevice = useDeviceConnectionStore((state) => state.lastConnectedDevice);
  const simulatedExperiment = useSimulatedExperiment();

  if (lastConnectedDevice?.type === "simulated-device" && !simulatedExperiment) return undefined;
  return lastConnectedDevice;
}
