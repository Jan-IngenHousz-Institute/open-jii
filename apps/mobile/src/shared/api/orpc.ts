import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getEnvVar } from "~/shared/stores/environment-store";

import { orpcContract } from "@repo/api/orpc-contract";

import { orpcFetch } from "./orpc-fetch";

const link = new OpenAPILink(orpcContract, {
  url: () => getEnvVar("BACKEND_URI"),
  headers: () => ({ "x-app-source": "orpc" }),
  fetch: orpcFetch,
});

/** Plain oRPC client for use outside of React components. */
export const orpcClient: ContractRouterClient<typeof orpcContract> = createORPCClient(link);

/** TanStack Query utilities (`orpc.<domain>.<endpoint>.queryOptions(...)`). */
export const orpc = createTanstackQueryUtils(orpcClient);
