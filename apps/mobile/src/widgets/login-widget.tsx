import { parse } from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { useAsyncCallback } from "react-async-hook";
import { Text, TouchableOpacity, View } from "react-native";
import { getLoginArgs } from "~/api/get-login-args";
import { getSession } from "~/api/get-session";

async function signIn() {
  const { expectedRedirectUrl, loginUrl } = getLoginArgs();
  const result = await openAuthSessionAsync(loginUrl, expectedRedirectUrl);

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

export function LoginWidget() {
  const {
    execute: startLoginFlow,
    result: user,
    reset,
  } = useAsyncCallback(async () => {
    const token = await signIn();

    if (!token) {
      return undefined;
    }

    return getSession(token);
  });

  function handleLogout() {
    reset();
  }

  return (
    <View className="flex-row items-center justify-end p-4">
      {user ? (
        <View className="flex-row items-center gap-4 space-x-3">
          <Text className="text-base font-medium text-gray-800">
            Hello {user?.user.email ?? "unknown"}
          </Text>
          <TouchableOpacity onPress={handleLogout} className="rounded-full bg-red-500 px-3 py-1">
            <Text className="font-semibold text-white">Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={startLoginFlow} className="rounded-full bg-blue-600 px-4 py-2">
          <Text className="font-semibold text-white">Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
