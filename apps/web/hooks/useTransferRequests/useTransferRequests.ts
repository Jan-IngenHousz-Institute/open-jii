import { tsr } from "@/lib/tsr";

export const useTransferRequests = () => {
  return tsr.experiments.listTransferRequests.useQuery({
    queryKey: ["transferRequests"],
  });
};
