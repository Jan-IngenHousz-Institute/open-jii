import { orpcHealth } from "@/lib/orpc-health";
import { useQuery } from "@tanstack/react-query";

export function useServerTime() {
  return useQuery(orpcHealth.getTime.queryOptions());
}
