import { useQueryClient } from "@tanstack/react-query";
import "expo-application";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { User, ExternalLink, LogOut } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView, Linking, Image } from "react-native";
import { showAlert } from "~/components/AlertDialog";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { colors } from "~/constants/colors";
import { useSession } from "~/hooks/use-session";
import { useThemeColors } from "~/hooks/use-theme-colors";
import { getEnvVar } from "~/stores/environment-store";
import { formatRelativeTime } from "~/utils/format-relative-time";

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const queryClient = useQueryClient();
  const themeColors = useThemeColors();

  const handleLogout = async () => {
    queryClient.resetQueries();
    await signOut();
  };

  const handleOpenWebProfile = async () => {
    const url = getEnvVar("NEXT_AUTH_URI") + "/en-US/platform/experiments";
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      showAlert("Error", "Cannot open web profile. Please check your internet connection.");
    }
  };

  if (!session) {
    return null;
  }

  const { user, expires } = session.data;

  return (
    <ScrollView className="bg-background flex-1" contentContainerStyle={{ padding: 16 }}>
      <View className="my-6 items-center">
        <View
          className="mb-4 h-20 w-20 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: colors.primary.dark + "30" }}
        >
          {user.image ? (
            <Image source={{ uri: user.image }} className="h-full w-full rounded-full" />
          ) : (
            <User size={40} color={themeColors.onSurface} />
          )}
        </View>
        <Text className="text-on-surface mb-1 text-xl font-bold">{user.name}</Text>
        <Text className="text-inactive text-base">{user.email}</Text>
      </View>

      <Card className="mb-6">
        <Text className="text-on-surface mb-4 text-lg font-bold">Account Information</Text>

        <View className="border-border flex-row justify-between border-b py-3">
          <Text className="text-inactive text-base">Organization</Text>
          <Text className="text-on-surface text-base font-medium">N/A</Text>
        </View>

        <View className="border-border flex-row justify-between border-b py-3">
          <Text className="text-inactive text-base">Login Expires</Text>
          <Text className="text-on-surface text-base font-medium">
            {formatRelativeTime(expires)}
          </Text>
        </View>
      </Card>

      <View className="mb-6">
        <Button
          title="Open Web Profile"
          onPress={handleOpenWebProfile}
          variant="outline"
          style={{ marginBottom: 12 }}
          icon={<ExternalLink size={16} color={colors.primary.dark} />}
        />

        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          style={{ marginBottom: 12, borderColor: colors.semantic.error }}
          textStyle={{ color: colors.semantic.error }}
          icon={<LogOut size={16} color={colors.semantic.error} />}
        />
      </View>

      <Text className="text-inactive mt-6 text-center text-sm">
        openJII v{Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
      </Text>
      {Updates.updateId && (
        <Text className="text-inactive mt-6 text-center text-sm">{Updates.updateId}</Text>
      )}
    </ScrollView>
  );
}
