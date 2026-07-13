import { useRouter } from "expo-router";
import { teardownFlow } from "~/features/measurement-flow/services/flow-actions";

/**
 * Finish a flow: tear down all flow state and land on Recent Measurements.
 * `router.replace` drops the pushed flow screen so it can't be swiped back in.
 *
 * Call only AFTER the measurement/questions upload has been awaited —
 * teardownFlow() clears the `experimentId`/`scanResult` the upload reads.
 */
export function useFinishFlow() {
  const router = useRouter();
  return () => {
    teardownFlow();
    router.replace("/(tabs)/recent-measurements");
  };
}
