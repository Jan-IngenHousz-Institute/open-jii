import type { CodegenConfig } from "@graphql-codegen/cli";

import type { ContentfulConfig } from "./lib/types";

const endpointOverride = process.env.CONTENTFUL_GRAPHQL_ENDPOINT;
const productionEndpoint = "https://graphql.contentful.com/content/v1/spaces";

/**
 * Generate a Contentful GraphQL endpoint URL from configuration
 */
export function getContentfulEndpoint(config: ContentfulConfig): string {
  const baseEndpoint = endpointOverride ?? productionEndpoint;
  return `${baseEndpoint}/${config.spaceId}/environments/${config.environment ?? "master"}`;
}

export const endpoint = getContentfulEndpoint({
  spaceId: process.env.CONTENTFUL_SPACE_ID ?? "",
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN ?? "",
  previewAccessToken: process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN ?? "",
  previewSecret: process.env.CONTENTFUL_PREVIEW_SECRET ?? "",
  environment: process.env.CONTENTFUL_SPACE_ENVIRONMENT ?? "master",
});

export const config: CodegenConfig = {
  overwrite: true,
  ignoreNoDocuments: true,
  schema: [
    {
      [endpoint || ""]: {
        headers: {
          Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}`,
        },
      },
    },
  ],
  generates: {
    "src/lib/__generated/graphql.schema.json": {
      plugins: ["introspection"],
    },
    "src/lib/__generated/graphql.schema.graphql": {
      plugins: ["schema-ast"],
    },
    "src/lib/__generated/sdk.ts": {
      documents: ["src/lib/graphql/**/*.graphql"],
      plugins: ["typescript", "typescript-operations", "typescript-graphql-request"],
      config: {
        rawRequest: false,
        inlineFragmentTypes: "combine",
        skipTypename: false,
        exportFragmentSpreadSubTypes: true,
        dedupeFragments: true,
        preResolveTypes: true,
      },
    },
  },
};

export default config;
