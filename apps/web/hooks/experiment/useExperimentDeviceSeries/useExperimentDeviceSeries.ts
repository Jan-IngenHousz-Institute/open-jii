import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface ExperimentDeviceSeriesInput {
  experimentId: string;
  clientId: string | null;
  from: string;
  to: string;
}

/**
 * One device's measurement volume inside one experiment. Disabled until a
 * device is selected, so the pane's empty state costs no request.
 */
export const useExperimentDeviceSeries = ({
  experimentId,
  clientId,
  from,
  to,
}: ExperimentDeviceSeriesInput) => {
  return useQuery(
    orpc.experiments.getExperimentDeviceSeries.queryOptions({
      input: { id: experimentId, clientId: clientId ?? "", from, to, bucket: "day" },
      enabled: clientId !== null,
    }),
  );
};
