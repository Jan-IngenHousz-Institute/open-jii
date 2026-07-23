import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { WebAuthnAbortService } from "@simplewebauthn/browser";
import {
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "../server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020";

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}/api/v1/auth`,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
    genericOAuthClient(), // Required for custom OAuth providers like ORCID
    organizationClient({ teams: { enabled: true } }),
    apiKeyClient(),
    passkeyClient(),
    lastLoginMethodClient(),
  ],
});

// Export useSession hook from Better Auth React
export const { useSession } = authClient;

/** Cancel an active WebAuthn ceremony before client-side navigation changes context. */
export function cancelPasskeyCeremony() {
  WebAuthnAbortService.cancelCeremony();
}

export type AuthClient = typeof authClient;
