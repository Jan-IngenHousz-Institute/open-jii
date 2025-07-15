import { parse } from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { useAsyncCallback } from "react-async-hook";
import { Text, TouchableOpacity, View } from "react-native";
import { getLoginArgs } from "~/api/get-login-args";
import { getSessionData } from "~/api/get-session-data";
import { login } from "~/auth/login";

export function LoginWidget() {
  const {
    execute: startLoginFlow,
    result: user,
    reset,
  } = useAsyncCallback(async () => {
    const token = await login();

    if (!token) {
      return undefined;
    }

    return getSessionData(token);
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
