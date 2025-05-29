import { createURL, parse } from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";
import { BigActionButton } from "~/components/big-action-button";
import { assertEnvVariables } from "~/utils/assert";

const { NEXT_AUTH_URI } = assertEnvVariables({
  NEXT_AUTH_URI: process.env.NEXT_AUTH_URI,
});

console.log("NEXT_AUTH_URI", NEXT_AUTH_URI);

async function signIn() {
  const signInUrl = `${NEXT_AUTH_URI}/api/auth/signin`;
  const redirectTo = createURL("/login");
  console.log("redirectTo", redirectTo);
  const loginUrl = `${signInUrl}?expo-redirect=${encodeURIComponent(redirectTo)}`;
  console.log("loginUrl", loginUrl);
  const result = await openAuthSessionAsync(loginUrl, redirectTo);

  console.log("result", result);

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

export function LoginScreen() {
  const { execute: startLoginFlow } = useAsyncCallback(async () => {
    const token = await signIn();
    console.log("token", token);
  });

  return (
    <View className="flex-1 items-center justify-center">
      <BigActionButton onPress={() => startLoginFlow()} text="Login" />
    </View>
  );
}
