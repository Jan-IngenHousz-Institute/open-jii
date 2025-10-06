import { parse } from "expo-linking";
import { getCustomTabsSupportingBrowsersAsync, openAuthSessionAsync } from "expo-web-browser";
import Toast from "react-native-toast-message";
import { getLoginArgs } from "~/api/get-login-args";
import { delay } from "~/utils/delay";

async function getBrowserPackage(): Promise<string | undefined> {
  try {
    const { preferredBrowserPackage, browserPackages } =
      await getCustomTabsSupportingBrowsersAsync();

    if (browserPackages.includes("com.android.chrome")) {
      return "com.android.chrome";
    }

    Toast.show({
      text1: "Chrome browser is recommended for safer login flow",
      type: "error",
    });
    await delay(3000);
    return preferredBrowserPackage;
  } catch {
    Toast.show({
      text1: "Chrome browser is recommended for safer login flow",
      type: "error",
    });
    await delay(3000);
    return undefined;
  }
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
