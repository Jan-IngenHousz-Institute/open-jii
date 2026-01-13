import {
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "./server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020";

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}/api/v1/auth`,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
    genericOAuthClient(), // Required for custom OAuth providers like ORCID
  ],
});

// Export useSession hook from Better Auth React
export const { useSession } = authClient;

export type AuthClient = typeof authClient;
