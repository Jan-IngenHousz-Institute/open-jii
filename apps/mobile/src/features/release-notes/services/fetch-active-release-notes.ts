import { getEnvVar } from "~/shared/stores/environment-store";

import { createContentfulClient } from "@repo/cms/client";
import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms/lib/__generated/sdk";

type ContentfulSdk = ReturnType<typeof createContentfulClient>["client"];

let cachedSdk: ContentfulSdk | null = null;
let cachedKey = "";

// Mirrors fetch-active-alerts.ts: cache the SDK client, re-create when env switches (dev ↔ prod).
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

export async function fetchActiveReleaseNotes(
  locale: string,
): Promise<ComponentReleaseNoteFieldsFragment[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const data = await client.activeReleaseNotes({
      preview: false,
      now: new Date().toISOString(),
      locale,
      surfaces: ["mobile", "both"],
    });

    return (data.componentReleaseNoteCollection?.items ?? []).filter(
      (item): item is ComponentReleaseNoteFieldsFragment => item !== null,
    );
  } catch (error) {
    // Fail-safe: degrade to an empty feed rather than surfacing a global error toast.
    console.warn("[contentful] failed to fetch release notes:", error);
    return [];
  }
}
