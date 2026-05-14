import "expo-application";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { User, ExternalLink, LogOut, Sun, Moon } from "lucide-react-native";
import React, { useContext } from "react";
import { View, Text, ScrollView, Linking, Image, Pressable } from "react-native";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useSession } from "~/features/auth/hooks/use-session";
import { colors } from "~/shared/constants/colors";
import { getEnvVar } from "~/shared/stores/environment-store";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { ThemeContext, ThemePreference } from "~/shared/ui/context/ThemeContext";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { formatRelativeTime } from "~/shared/utils/format-relative-time";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  Icon: React.FC<{ size: number; color: string }>;
}[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export default function ProfileScreen() {
  const { session } = useSession();
  const handleLogout = useLogout();
  const themeColors = useThemeColors();
  const { themePreference, changeTheme } = useContext(ThemeContext);

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
          style={{ backgroundColor: themeColors.brand + "30" }}
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

      <Card className="mb-6">
        <Text className="text-on-surface mb-4 text-lg font-bold">Appearance</Text>
        <View className="flex-row gap-2">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = themePreference === value;
            return (
              <Pressable
                key={value}
                onPress={() => changeTheme(value)}
                className="flex-1 items-center gap-1.5 rounded-xl border py-3"
                style={{
                  borderColor: active ? themeColors.brand : themeColors.border,
                  backgroundColor: active ? themeColors.brand + "18" : "transparent",
                }}
              >
                <Icon size={18} color={active ? themeColors.brand : themeColors.inactive} />
                <Text
                  style={{ color: active ? themeColors.brand : themeColors.inactive }}
                  className="text-sm font-medium"
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View className="mb-6">
        <Button
          title="Open Web Profile"
          onPress={handleOpenWebProfile}
          variant="outline"
          style={{ marginBottom: 12 }}
          icon={<ExternalLink size={16} color={themeColors.brand} />}
        />

        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="danger"
          style={{ marginBottom: 12 }}
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
