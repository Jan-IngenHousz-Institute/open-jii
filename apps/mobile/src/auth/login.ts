import { parse } from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { getLoginArgs } from "~/api/get-login-args";

export async function login() {
  const { expectedRedirectUrl, loginUrl } = getLoginArgs();

  const result = await openAuthSessionAsync(loginUrl, expectedRedirectUrl, {
    browserPackage: "com.android.chrome",
  });

  if (result.type !== "success") {
    return undefined;
  }
  const url = parse(result.url);
  const sessionToken = String(url.queryParams?.session_token);
  if (!sessionToken) {
    throw new Error("No session token found");
  }

  return sessionToken;
}
