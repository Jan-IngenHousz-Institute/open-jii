import { useQuery } from "@tanstack/react-query";
import { fetchActiveAlerts } from "~/services/contentful";
import { useDismissedAlertsStore } from "~/stores/dismissed-alerts-store";
import { useEnvironmentStore } from "~/stores/environment-store";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const FIVE_MINUTES = 5 * 60 * 1000;

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;
type Severity = keyof typeof SEVERITY_ORDER;

export function useActiveAlerts(locale = "en-US"): ComponentAlertFieldsFragment[] {
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);
  const dismissedIds = useDismissedAlertsStore((s) => s.dismissedIds);

  const { data: alerts } = useQuery({
    queryKey: ["contentful", "active-alerts", locale],
    queryFn: () => fetchActiveAlerts(locale),
    enabled: envLoaded,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });

  if (!alerts) return [];

  return alerts
    .filter((a) => !dismissedIds.includes(a.internalName ?? a.sys.id))
    .sort((a, b) => {
      const aOrder = SEVERITY_ORDER[(a.severity ?? "info") as Severity] ?? 2;
      const bOrder = SEVERITY_ORDER[(b.severity ?? "info") as Severity] ?? 2;
      return aOrder - bOrder;
    });
}
