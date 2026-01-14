import * as SecureStore from "expo-secure-store";
import { getEnvName, getEnvVar } from "~/stores/environment-store";

import { createNativeAuthClient } from "@repo/auth/client.native";

export const authClient = createNativeAuthClient({
  backendUrl: getEnvVar("BACKEND_URI"),
  environmentName: getEnvName(),
  storage: SecureStore,
  scheme: "openjii",
  storagePrefix: "openjii",
});

export const { useSession } = authClient;

export type AuthClient = typeof authClient;
