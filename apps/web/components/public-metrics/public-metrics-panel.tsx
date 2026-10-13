import { createAnonymousServerOrpcClient } from "~/lib/server-orpc";

import { PublicMetricsSection } from "./public-metrics-section";

interface PublicMetricsPanelProps {
  locale: string;
}

/**
 * Fetches its own figures so the landing page can stream without waiting on the
 * warehouse. A failed read drops the section rather than erroring the page. The
 * figures are public, so the read carries no session and the page stays cacheable.
 */
export async function PublicMetricsPanel({ locale }: PublicMetricsPanelProps) {
  try {
    const orpc = createAnonymousServerOrpcClient();
    const metrics = await orpc.metrics.getPublicMetrics();

    return <PublicMetricsSection metrics={metrics} locale={locale} />;
  } catch {
    return null;
  }
}
