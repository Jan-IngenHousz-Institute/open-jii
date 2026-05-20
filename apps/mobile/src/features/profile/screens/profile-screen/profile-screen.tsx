import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import React, { useRef } from "react";
import { ScrollView, Text } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { AppSettingsSheet } from "~/features/profile/components/app-settings-sheet";
import { ProfileAccountCard } from "~/features/profile/components/profile-account-card";
import { ProfileHardwareCard } from "~/features/profile/components/profile-hardware-card";
import { ProfileIdentity } from "~/features/profile/components/profile-identity";
import { ProfileSignoutCard } from "~/features/profile/components/profile-signout-card";
import { useTranslation } from "~/shared/i18n";

export function ProfileScreen() {
  const { session } = useSession();
  const { t } = useTranslation("profile");
  const sheetRef = useRef<BottomSheetModal>(null);

  if (!session) return null;

  const { user } = session.data;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <ProfileIdentity name={user.name} email={user.email} imageUri={user.image} />
      <ProfileHardwareCard />
      <ProfileAccountCard onOpenAppSettings={() => sheetRef.current?.present()} />
      <ProfileSignoutCard />

      <Text className="text-muted-body mt-6 text-center text-[12px]">
        {t("footer", {
          version: Application.nativeApplicationVersion ?? "",
          build: Application.nativeBuildVersion ?? "",
        })}
      </Text>
      {Updates.updateId ? (
        <Text className="text-muted-body mt-1 text-center text-[11px]">{Updates.updateId}</Text>
      ) : null}

      <AppSettingsSheet ref={sheetRef} />
    </ScrollView>
  );
}

export default ProfileScreen;
