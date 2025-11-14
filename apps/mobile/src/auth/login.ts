import { parse } from "expo-linking";
import * as Linking from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { toast } from "sonner-native";
import { getLoginArgs } from "~/api/get-login-args";
import { delay } from "~/utils/delay";

async function getBrowserPackage(): Promise<string | undefined> {
  try {
    // Check if Chrome package URL scheme can be opened
    if (await Linking.canOpenURL("googlechrome://")) {
      return "com.android.chrome";
    }
  } catch {
    // ignored
  }

  toast.error("Chrome browser is recommended for safer login flow");
  await delay(3000);
  return undefined; // fallback to system default
}

export async function login() {
  const { expectedRedirectUrl, loginUrl } = getLoginArgs();
  const browserPackage = await getBrowserPackage();

  const result = await openAuthSessionAsync(loginUrl, expectedRedirectUrl, {
    browserPackage,
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
