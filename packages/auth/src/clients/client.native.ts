import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient, genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

// const BACKEND_URL = process.env.EXPO_PUBLIC_PROD_BACKEND_URI ?? "https://api.dev.openjii.org";
const SCHEME = "openjii";
const STORAGE_PREFIX = "openjii";

// export const authClient = createAuthClient({
//   baseURL: `${BACKEND_URL}/api/v1/auth`,
//   plugins: [
//     emailOTPClient(),
//     genericOAuthClient(),
//     expoClient({
//       scheme: SCHEME,
//       storagePrefix: STORAGE_PREFIX,
//       storage: SecureStore,
//     }),
//   ],
// });


// export const useSession = authClient.useSession;
// export type AuthClient = typeof authClient;

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
