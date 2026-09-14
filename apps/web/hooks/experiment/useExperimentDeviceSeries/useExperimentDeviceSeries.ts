import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface ExperimentDeviceSeriesInput {
  experimentId: string;
  clientId: string;
  from: string;
  to: string;
}

/** One device's measurement volume inside one experiment. */
export const useExperimentDeviceSeries = ({
  experimentId,
  clientId,
  from,
  to,
}: ExperimentDeviceSeriesInput) => {
  return useQuery(
    orpc.experiments.getExperimentDeviceSeries.queryOptions({
      input: { id: experimentId, clientId, from, to, bucket: "day" },
    }),
  );
};
