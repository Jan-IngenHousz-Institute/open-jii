import { getContentfulClient } from "~/shared/api/contentful-client";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

/**
 * The single published force-update gate entry, or `null` when there's no client
 * (missing creds) or nothing published. `preview: false` — no preview on device.
 */
export async function fetchForceUpdate(
  locale: string,
): Promise<PageForceUpdateFieldsFragment | null> {
  const client = getContentfulClient();
  if (!client) return null;

  const data = await client.pageForceUpdate({ preview: false, locale });
  return data.pageForceUpdateCollection?.items?.[0] ?? null;
}
