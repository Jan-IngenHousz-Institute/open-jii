import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The sensors a device's readings in this experiment name, such as the Ambits on an Ambyte. */
export const useExperimentDeviceSensors = (experimentId: string, deviceId: string) =>
  useQuery(
    orpc.experiments.listDeviceSensors.queryOptions({
      input: { id: experimentId, deviceId },
    }),
  );
