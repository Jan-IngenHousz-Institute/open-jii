import { getEnvVar } from "~/shared/stores/environment-store";

import { createContentfulClient } from "@repo/cms/client";
import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

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

/**
 * The single published force-update gate entry, or `null` when there's no client
 * (missing creds) or nothing published. `preview: false` — no preview on device.
 */
export async function fetchForceUpdate(
  locale: string,
): Promise<PageForceUpdateFieldsFragment | null> {
  const client = getClient();
  if (!client) return null;

  const data = await client.pageForceUpdate({ preview: false, locale });
  return data.pageForceUpdateCollection?.items?.[0] ?? null;
}
