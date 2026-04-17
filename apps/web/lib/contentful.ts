/* eslint-disable no-restricted-properties */
import { env } from "~/env";

import { createContentfulClient } from "@repo/cms";
import type { ContentfulClients } from "@repo/cms";

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

// Cache only after a successful config fetch — a failed cold-start fetch
// (ECONNRESET from the secrets extension) must not be permanently memoized.
let _contentfulClientsPromise: Promise<ContentfulClients> | null = null;

export const getContentfulClients = async (): Promise<ContentfulClients> => {
  if (!_contentfulClientsPromise) {
    _contentfulClientsPromise = getContentfulConfig()
      .then((config) => createContentfulClient(config))
      .catch((err) => {
        _contentfulClientsPromise = null; // Allow retry on next request
        throw err;
      });
  }
  return _contentfulClientsPromise;
};
