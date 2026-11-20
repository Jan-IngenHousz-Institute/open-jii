import { expoClient } from "@better-auth/expo/client";
import {
  emailOTPClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const SCHEME = "openjii";
const STORAGE_PREFIX = "openjii";

// The native secure-storage impl (e.g. expo-secure-store) is injected by the
// consumer so this server/web-shared package never depends on a native module.
type SecureStorage = Parameters<typeof expoClient>[0]["storage"];

export function createOpenJiiAuthClient(backendUrl: string, storage: SecureStorage) {
  return createAuthClient({
    baseURL: `${backendUrl}/api/v1/auth`,
    plugins: [
      // Declared by hand: inferring from `../server` would pull the server's types into the app build.
      inferAdditionalFields({
        user: { registered: { type: "boolean", required: false } },
      }),
      emailOTPClient(),
      organizationClient({ teams: { enabled: true } }),
      expoClient({
        scheme: SCHEME,
        storagePrefix: STORAGE_PREFIX,
        storage,
      }),
    ],
  });
}
