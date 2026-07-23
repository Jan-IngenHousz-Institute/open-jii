import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { healthContract } from "@repo/api/domains/health/health.contract";

const link = new OpenAPILink(healthContract, {
  url: "http://localhost:3020",
});

const healthClient: ContractRouterClient<typeof healthContract> = createORPCClient(link);

export const orpcHealth = createTanstackQueryUtils(healthClient);
