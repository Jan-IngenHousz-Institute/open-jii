import { expoClient } from "@better-auth/expo/client";
import {
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "../server";

export interface NativeAuthConfig {
  backendUrl: string;
  environmentName: string;
  storage: {
    setItem: (key: string, value: string) => void;
    getItem: (key: string) => string | null;
  };
  scheme?: string;
  storagePrefix?: string;
}

export function createNativeAuthClient(config: NativeAuthConfig) {
  const {
    backendUrl,
    environmentName,
    storage,
    scheme = "openjii",
    storagePrefix = "openjii",
  } = config;

  return createAuthClient({
    baseURL: `${backendUrl}/api/v1/auth`,
    plugins: [
      inferAdditionalFields<typeof auth>(),
      emailOTPClient(),
      genericOAuthClient(),
      expoClient({
        scheme,
        storagePrefix,
        storage,
        cookiePrefix: [
          "better-auth",
          `better-auth.${environmentName}`,
          `__Secure-better-auth.${environmentName}`,
        ],
      }),
    ],
  });
}
