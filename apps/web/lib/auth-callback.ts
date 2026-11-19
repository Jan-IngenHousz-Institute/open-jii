import { env } from "~/env";

import { resolveAuthCallback } from "@repo/auth/redirects";

export function getAuthCallback(callbackUrl: string | undefined): string {
  return resolveAuthCallback(callbackUrl, {
    baseUrl: env.NEXT_PUBLIC_BASE_URL,
    environment: env.NEXT_PUBLIC_ENVIRONMENT,
  });
}
