import { GraphQLClient } from "graphql-request";

import { getContentfulEndpoint } from "../codegen";
import { getSdk } from "../lib/__generated/sdk";
import type { ContentfulConfig } from "./types";
import { defaultConfig } from "./types";

type ContentfulSdk = ReturnType<typeof getSdk>;

export interface ContentfulClients {
  client: ContentfulSdk;
  previewClient: ContentfulSdk;
}

export function createContentfulClient(
  config: ContentfulConfig = defaultConfig,
): ContentfulClients {
  const customEndpoint = getContentfulEndpoint(config);

  const graphQlClient = new GraphQLClient(customEndpoint, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  const previewGraphQlClient = new GraphQLClient(customEndpoint, {
    headers: {
      Authorization: `Bearer ${config.previewAccessToken}`,
    },
  });

  return {
    client: getSdk(graphQlClient),
    previewClient: getSdk(previewGraphQlClient),
  };
}

// Default clients using environment variables
const defaultClients: ContentfulClients = createContentfulClient();
const client: ContentfulSdk = defaultClients.client;
const previewClient: ContentfulSdk = defaultClients.previewClient;

export { client, previewClient };
