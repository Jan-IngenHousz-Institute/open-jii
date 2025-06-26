import { GraphQLClient } from "graphql-request";

import { endpoint } from "../codegen";
import { getSdk } from "../lib/__generated/sdk";

const graphQlClient = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}`,
  },
});

const previewGraphQlClient = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN}`,
  },
});

type Sdk = ReturnType<typeof getSdk>;

export const client: Sdk = getSdk(graphQlClient);
export const previewClient: Sdk = getSdk(previewGraphQlClient);
