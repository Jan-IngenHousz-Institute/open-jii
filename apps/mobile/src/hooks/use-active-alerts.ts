import { useQuery } from "@tanstack/react-query";
import { fetchActiveAlerts } from "~/services/contentful";
import { useEnvironmentStore } from "~/stores/environment-store";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useActiveAlerts(locale = "en-US") {
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);
  return useQuery({
    queryKey: ["contentful", "active-alerts", locale],
    queryFn: () => fetchActiveAlerts(locale),
    enabled: envLoaded,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}
