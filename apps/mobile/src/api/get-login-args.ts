import { createURL } from "expo-linking";
import { getEnvVar } from "~/stores/environment-store";

export function getLoginArgs() {
  const nextRedirectUri = getEnvVar("NEXT_AUTH_URI") + "/api/auth/mobile-redirect";

  const signInUrl = `${getEnvVar("NEXT_AUTH_URI")}/api/auth/signin`;
  const loginUrl = `${signInUrl}?callbackUrl=${encodeURIComponent(nextRedirectUri)}`;
  const expectedRedirectUrl = createURL("/callback");
  return { loginUrl, expectedRedirectUrl };
}
