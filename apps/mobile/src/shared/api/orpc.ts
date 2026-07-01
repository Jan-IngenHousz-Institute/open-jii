import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getEnvVar } from "~/shared/stores/environment-store";

import { contract } from "@repo/api/contract";

import { orpcFetch } from "./orpc-fetch";

const link = new OpenAPILink(contract, {
  url: () => getEnvVar("BACKEND_URI"),
  headers: () => ({ "x-app-source": "orpc" }),
  fetch: orpcFetch,
});

/** Plain oRPC client for use outside of React components. */
export const orpcClient: ContractRouterClient<typeof contract> = createORPCClient(link);

/** TanStack Query utilities (`orpc.<domain>.<endpoint>.queryOptions(...)`). */
export const orpc = createTanstackQueryUtils(orpcClient);
