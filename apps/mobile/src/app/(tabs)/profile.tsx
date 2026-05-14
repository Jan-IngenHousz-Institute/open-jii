import "expo-application";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Moon, Sun, Smartphone, User, ExternalLink, LogOut } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView, Linking, Image, Pressable } from "react-native";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useSession } from "~/features/auth/hooks/use-session";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { getEnvVar } from "~/shared/stores/environment-store";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import type { ThemePreference } from "~/shared/ui/context/ThemeContext";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { useThemePreference } from "~/shared/ui/hooks/use-theme-preference";
import { formatRelativeTime } from "~/shared/utils/format-relative-time";

const THEME_OPTIONS: {
  key: ThemePreference;
  labelKey: "themeSystem" | "themeLight" | "themeDark";
  Icon: typeof Sun;
}[] = [
  { key: "system", labelKey: "themeSystem", Icon: Smartphone },
  { key: "light", labelKey: "themeLight", Icon: Sun },
  { key: "dark", labelKey: "themeDark", Icon: Moon },
];

export default function ProfileScreen() {
  const { session } = useSession();
  const handleLogout = useLogout();
  const themeColors = useThemeColors();
  const { themePreference, changeTheme } = useThemePreference();
  const { t } = useTranslation(["common", "profile"]);

  const handleOpenWebProfile = async () => {
    const url = getEnvVar("NEXT_AUTH_URI") + "/en-US/platform/experiments";
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      showAlert(t("common:errorTitle"), t("profile:cannotOpenWebProfile"));
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
        <Text className="text-on-surface mb-4 text-lg font-bold">
          {t("profile:accountInformation")}
        </Text>

        <View className="border-border flex-row justify-between border-b py-3">
          <Text className="text-inactive text-base">{t("profile:organization")}</Text>
          <Text className="text-on-surface text-base font-medium">
            {t("profile:organizationNone")}
          </Text>
        </View>

        <View className="border-border flex-row justify-between border-b py-3">
          <Text className="text-inactive text-base">{t("profile:loginExpires")}</Text>
          <Text className="text-on-surface text-base font-medium">
            {formatRelativeTime(expires)}
          </Text>
        </View>
      </Card>

      <Card className="mb-6">
        <Text className="text-on-surface mb-4 text-lg font-bold">{t("profile:appearance")}</Text>
        <View className="flex-row gap-2">
          {THEME_OPTIONS.map(({ key, labelKey, Icon }) => {
            const isActive = themePreference === key;
            return (
              <Pressable
                key={key}
                onPress={() => void changeTheme(key)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-3 py-2"
                style={{
                  borderColor: isActive ? themeColors.brand : themeColors.border,
                  backgroundColor: isActive ? themeColors.brand + "15" : "transparent",
                }}
              >
                <Icon size={16} color={isActive ? themeColors.brand : themeColors.onSurface} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: isActive ? themeColors.brand : themeColors.onSurface }}
                >
                  {t(`profile:${labelKey}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View className="mb-6">
        <Button
          title={t("profile:openWebProfile")}
          onPress={handleOpenWebProfile}
          variant="outline"
          style={{ marginBottom: 12 }}
          icon={<ExternalLink size={16} color={themeColors.brand} />}
        />

        <Button
          title={t("profile:logOut")}
          onPress={handleLogout}
          variant="danger"
          style={{ marginBottom: 12 }}
          icon={<LogOut size={16} color={colors.semantic.error} />}
        />
      </View>

      <Text className="text-inactive mt-6 text-center text-sm">
        {t("common:appName")} v{Application.nativeApplicationVersion} (
        {Application.nativeBuildVersion})
      </Text>
      {Updates.updateId && (
        <Text className="text-inactive mt-6 text-center text-sm">{Updates.updateId}</Text>
      )}
    </ScrollView>
  );
}
