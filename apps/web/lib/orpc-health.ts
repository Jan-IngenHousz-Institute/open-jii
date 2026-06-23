import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { healthOrpcContract } from "@repo/api/domains/health/health.orpc";

const link = new OpenAPILink(healthOrpcContract, {
  url: "http://localhost:3020",
});

const healthClient: ContractRouterClient<typeof healthOrpcContract> = createORPCClient(link);

export const orpcHealth = createTanstackQueryUtils(healthClient);
