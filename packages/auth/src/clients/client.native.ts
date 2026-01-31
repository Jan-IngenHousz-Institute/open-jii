import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient, genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const SCHEME = "openjii";
const STORAGE_PREFIX = "openjii";

export function createOpenJiiAuthClient(backendUrl: string) {
  return createAuthClient({
    baseURL: `${backendUrl}/api/v1/auth`,
    plugins: [
      emailOTPClient(),
      genericOAuthClient(),
      expoClient({
        scheme: SCHEME,
        storagePrefix: STORAGE_PREFIX,
        storage: SecureStore,
      }),
    ],
  });
}
