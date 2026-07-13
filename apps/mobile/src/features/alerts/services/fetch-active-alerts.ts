import { getContentfulClient } from "~/shared/api/contentful-client";
import { createLogger } from "~/shared/observability/logger";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const log = createLogger("contentful");

export async function fetchActiveAlerts(locale: string): Promise<ComponentAlertFieldsFragment[]> {
  const client = getContentfulClient();
  if (!client) return [];

  try {
    log.debug("fetching active alerts", { locale });
    const data = await client.activeAlerts({
      preview: false,
      now: new Date().toISOString(),
      locale,
      audience: ["mobile", "both"],
    });

    return (data.componentAlertCollection?.items ?? []).filter(
      (item): item is ComponentAlertFieldsFragment => item !== null,
    );
  } catch (error) {
    // Contentful unreachable (network, 5xx, or a stale/invalid token → 401).
    // Alerts are a non-critical banner, so degrade to none rather than letting
    // the throw reach the global query error toast and fill the screen.
    console.warn("[contentful] failed to fetch active alerts:", error);
    return [];
  }
}
