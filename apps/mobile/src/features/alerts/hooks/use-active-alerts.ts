import { useQuery } from "@tanstack/react-query";
import { fetchActiveAlerts } from "~/features/alerts/services/fetch-active-alerts";
import { useDismissedAlertsStore } from "~/features/alerts/stores/dismissed-alerts-store";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import { severityRank } from "@repo/cms/alert";
import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useActiveAlerts(locale = "en-US"): ComponentAlertFieldsFragment[] {
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);
  const dismissedIds = useDismissedAlertsStore((s) => s.dismissedIds);

  const { data: alerts } = useQuery({
    queryKey: ["contentful", "active-alerts", locale],
    queryFn: () => fetchActiveAlerts(locale),
    enabled: envLoaded,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
    refetchOnMount: true,
  });

  if (!alerts) return [];

  return alerts
    .filter((a) => !dismissedIds.includes(a.internalName ?? a.sys.id))
    .sort((a, b) => severityRank(a) - severityRank(b));
}
