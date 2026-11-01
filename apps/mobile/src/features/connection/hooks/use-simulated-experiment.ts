import { useSyncExternalStore } from "react";
import {
  simulatedExperimentId,
  subscribeSimulatedExperiment,
} from "~/features/connection/services/simulated-device";

export function useSimulatedExperiment() {
  return useSyncExternalStore(subscribeSimulatedExperiment, simulatedExperimentId, () => undefined);
}
