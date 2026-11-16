import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useReviewQueue = () => {
  return useQuery(orpc.datasets.listReviewQueue.queryOptions());
};
