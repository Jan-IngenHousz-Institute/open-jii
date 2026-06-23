import { useQuery } from "@tanstack/react-query";

import { orpcHealth } from "@/lib/orpc-health";

export function useServerTime() {
  return useQuery(orpcHealth.getTime.queryOptions());
}
