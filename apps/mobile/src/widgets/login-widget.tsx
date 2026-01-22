import { useAsyncCallback } from "react-async-hook";
import { Text, TouchableOpacity, View } from "react-native";

import { authClient } from "@repo/auth/client.native";

export function LoginWidget() {
  const { data: session, isPending } = authClient.useSession();

  const { execute: startLoginFlow } = useAsyncCallback(async () => {
    // Trigger GitHub OAuth login (or whichever provider you want)
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/", // Will be converted to openjii:// deep link
    });
  });

  async function handleLogout() {
    await authClient.signOut();
  }

  if (isPending) {
    return (
      <View className="flex-row items-center justify-end p-4">
        <Text className="text-base text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-end p-4">
      {session ? (
        <View className="flex-row items-center gap-4 space-x-3">
          <Text className="text-base font-medium text-gray-800">
            Hello {session.user.email ?? "unknown"}
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
