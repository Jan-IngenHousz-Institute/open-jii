/* eslint-disable no-restricted-properties */
import { env } from "~/env";

import { createContentfulClient } from "@repo/cms/client";
import type { ContentfulClients } from "@repo/cms";
import { defaultLocale } from "@repo/i18n/config";

import { getSecret, isLambdaEnvironment } from "./secrets";
import type { SecretMap } from "./secrets";

export interface ContentfulConfig {
  spaceId: string;
  accessToken: string;
  previewAccessToken: string;
  previewSecret: string;
  environment?: string;
}

/**
 * Initialize Contentful configuration by loading secrets from environment
 * or AWS Secrets Manager in Lambda environments
 */
export async function getContentfulConfig(): Promise<ContentfulConfig> {
  const isLambda = isLambdaEnvironment();
  let contentfulSecrets: SecretMap = {};

  // Load secrets from AWS Secrets Manager in Lambda environments
  if (isLambda) {
    contentfulSecrets = await getSecret(process.env.CONTENTFUL_SECRET_ARN ?? "");
  }

  // Use secrets from environment or AWS Secrets Manager
  const config: ContentfulConfig = {
    spaceId: (contentfulSecrets.CONTENTFUL_SPACE_ID || env.CONTENTFUL_SPACE_ID) ?? "",
    accessToken: (contentfulSecrets.CONTENTFUL_ACCESS_TOKEN || env.CONTENTFUL_ACCESS_TOKEN) ?? "",
    previewAccessToken:
      (contentfulSecrets.CONTENTFUL_PREVIEW_ACCESS_TOKEN || env.CONTENTFUL_PREVIEW_ACCESS_TOKEN) ??
      "",
    previewSecret:
      (contentfulSecrets.CONTENTFUL_PREVIEW_SECRET || env.CONTENTFUL_PREVIEW_SECRET) ?? "",
    environment: env.CONTENTFUL_SPACE_ENVIRONMENT || "master",
  };

  return config;
}

// Memoize the configuration to avoid repeated calls
const contentfulConfigPromise = getContentfulConfig();

// Export the config promise to be used in the application
export const contentfulConfig = contentfulConfigPromise;

/**
 * Initialize Contentful clients with the configuration from the contentful config
 */
export async function initializeContentfulClients(): Promise<ContentfulClients> {
  const config = await contentfulConfig;

  return createContentfulClient(config);
}

/**
 * The public pages' locales to render at build time. A build that cannot read the CMS, such as a
 * pull request check, renders none ahead and leaves each page to its first visit.
 */
export async function buildTimeLocaleParams(): Promise<{ locale: string }[]> {
  const { spaceId, accessToken } = await contentfulConfig;
  return spaceId && accessToken ? [{ locale: defaultLocale }] : [];
}

// Create a singleton instance of the Contentful clients
const contentfulClientsPromise: Promise<ContentfulClients> = initializeContentfulClients();

export const getContentfulClients = async (): Promise<ContentfulClients> => {
  return contentfulClientsPromise;
};
