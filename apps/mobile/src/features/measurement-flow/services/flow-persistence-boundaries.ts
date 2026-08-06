import type { AppStateStatus } from "react-native";
import { flushRunnerMeasurementFlowSnapshot } from "~/features/measurement-flow/stores/use-measurement-flow-store";

/** Synchronous durability fence used immediately before leaving the flow. */
export function flushMeasurementFlowForPause(): void {
  flushRunnerMeasurementFlowSnapshot();
}

/** AppState boundary: background/inactive must not leave the debounced cursor behind. */
export function flushMeasurementFlowForAppState(nextState: AppStateStatus): void {
  if (nextState !== "active") flushRunnerMeasurementFlowSnapshot();
}
