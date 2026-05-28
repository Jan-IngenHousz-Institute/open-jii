import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { pruneExpiredMeasurements } from "~/shared/db/measurements-storage";

export function usePruneExpiredMeasurements() {
  const queryClient = useQueryClient();
  useEffect(() => {
    void pruneExpiredMeasurements().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["measurements"] });
    });
  }, [queryClient]);
}
