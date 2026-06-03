import { getEnvVar } from "~/shared/stores/environment-store";

import { createContentfulClient } from "@repo/cms/client";
import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

type ContentfulSdk = ReturnType<typeof createContentfulClient>["client"];

let cachedSdk: ContentfulSdk | null = null;
let cachedKey = "";

function getClient(): ContentfulSdk | null {
  let spaceId: string;
  let accessToken: string;
  let environment: string;
  try {
    spaceId = getEnvVar("CONTENTFUL_SPACE_ID", false);
    accessToken = getEnvVar("CONTENTFUL_ACCESS_TOKEN", false);
    environment = getEnvVar("CONTENTFUL_SPACE_ENVIRONMENT", false) || "master";
  } catch {
    return null;
  }

  if (!spaceId || !accessToken) return null;

  // Re-create when env switches (dev ↔ prod) so we don't keep stale credentials.
  const key = `${spaceId}:${environment}`;
  if (cachedSdk && cachedKey === key) return cachedSdk;

  const { client } = createContentfulClient({
    spaceId,
    accessToken,
    previewAccessToken: "",
    previewSecret: "",
    environment,
  });

  cachedSdk = client;
  cachedKey = key;
  return client;
}

export async function fetchActiveAlerts(locale: string): Promise<ComponentAlertFieldsFragment[]> {
  const client = getClient();
  if (!client) return [];

  console.log("[contentful] fetching active alerts, locale:", locale);
  const data = await client.activeAlerts({
    preview: false,
    now: new Date().toISOString(),
    locale,
    audience: ["mobile", "both"],
  });

  return (data.componentAlertCollection?.items ?? []).filter(
    (item): item is ComponentAlertFieldsFragment => item !== null,
  );
}
