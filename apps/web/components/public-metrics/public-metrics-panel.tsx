import { createServerOrpcClient } from "~/lib/server-orpc";

import { PublicMetricsSection } from "./public-metrics-section";

interface PublicMetricsPanelProps {
  locale: string;
}

/**
 * Fetches its own figures so the landing page can stream without waiting on the
 * warehouse. A failed read drops the section rather than erroring the page.
 */
export async function PublicMetricsPanel({ locale }: PublicMetricsPanelProps) {
  try {
    const orpc = await createServerOrpcClient();
    const metrics = await orpc.metrics.getPublicMetrics();

    return <PublicMetricsSection metrics={metrics} locale={locale} />;
  } catch {
    return null;
  }
}
