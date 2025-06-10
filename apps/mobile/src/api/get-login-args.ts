import { createURL } from "expo-linking";
import { assertEnvVariables } from "~/utils/assert";

const { NEXT_AUTH_URI } = assertEnvVariables({
  NEXT_AUTH_URI: process.env.NEXT_AUTH_URI,
});

const nextRedirectUri = NEXT_AUTH_URI + "/api/auth/mobile-redirect";

export function getLoginArgs() {
  const signInUrl = `${NEXT_AUTH_URI}/api/auth/signin`;
  const loginUrl = `${signInUrl}?callbackUrl=${encodeURIComponent(nextRedirectUri)}`;
  const expectedRedirectUrl = createURL("/callback");
  return { loginUrl, expectedRedirectUrl };
}
