import { getContentfulClients } from "@/shared/cms/contentful";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { AlertsContainer } from "@repo/cms";
import type { ComponentAlertFieldsFragment } from "@repo/cms";

interface AlertsBarProps {
  locale: string;
  preview: boolean;
}

// Cached across all requests for 5 minutes — one Contentful hit per TTL window per locale
const getActiveAlerts = unstable_cache(
  async (locale: string) => {
    const { client } = await getContentfulClients();
    const data = await client.activeAlerts({
      preview: false,
      now: new Date().toISOString(),
      locale,
      audience: ["web", "both"],
    });
    return (data.componentAlertCollection?.items ?? []).filter(
      (item): item is ComponentAlertFieldsFragment => item !== null,
    );
  },
  ["active-alerts"],
  { revalidate: 300 },
);

// Preview always fetches live — editors need to see unpublished changes immediately
const getPreviewAlerts = cache(async (locale: string) => {
  const { previewClient } = await getContentfulClients();
  const data = await previewClient.activeAlerts({
    preview: true,
    now: new Date().toISOString(),
    locale,
    audience: ["web", "both"],
  });
  return (data.componentAlertCollection?.items ?? []).filter(
    (item): item is ComponentAlertFieldsFragment => item !== null,
  );
});

export async function AlertsBar({ locale, preview }: AlertsBarProps) {
  const alerts = await (preview ? getPreviewAlerts(locale) : getActiveAlerts(locale));
  if (alerts.length === 0) return null;
  return <AlertsContainer alerts={alerts} />;
}
