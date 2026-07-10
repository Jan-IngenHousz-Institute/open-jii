import { getEnvVar } from "~/shared/stores/environment-store";

import { createContentfulClient } from "@repo/cms/client";

export type ContentfulSdk = ReturnType<typeof createContentfulClient>["client"];

let cachedSdk: ContentfulSdk | null = null;
let cachedKey = "";

// Same convention as aws-iot-auth's _reset*ForTests.
export function _resetContentfulClientForTests(): void {
  cachedSdk = null;
  cachedKey = "";
}

/**
 * The one Contentful SDK for the app (alerts, force-update, …). Returns null
 * when credentials are absent (e.g. local dev without Contentful env).
 */
export function getContentfulClient(): ContentfulSdk | null {
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
  const key = `${spaceId}:${environment}:${accessToken}`;
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
