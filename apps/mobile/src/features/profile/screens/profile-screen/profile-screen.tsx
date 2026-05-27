import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { FlaskConical } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { AppSettingsSheet } from "~/features/profile/components/app-settings-sheet";
import { ProfileAccountCard } from "~/features/profile/components/profile-account-card";
import { ProfileHardwareCard } from "~/features/profile/components/profile-hardware-card";
import { ProfileIdentity } from "~/features/profile/components/profile-identity";
import { ProfileSignoutCard } from "~/features/profile/components/profile-signout-card";
import { useIsDevelopment } from "~/features/profile/hooks/use-is-development";
import { DevSeedMeasurementsDialog } from "~/features/recent-measurements/components/dev-seed-measurements-dialog";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";

export function ProfileScreen() {
  const { session } = useSession();
  const { t } = useTranslation("profile");
  const sheetRef = useRef<BottomSheetModal>(null);
  // Dev tooling only appears when the app points at a non-prod environment.
  const isDev = useIsDevelopment();
  const [seedVisible, setSeedVisible] = useState(false);

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

      {isDev ? (
        <View className="mb-4">
          <Text className="text-muted-body mb-2 px-1 text-[12px] font-bold uppercase tracking-wider">
            Developer
          </Text>
          <Card padded={false}>
            <RowItem
              icon={<FlaskConical size={18} color={colors.jii.darkGreen} />}
              iconBackgroundClassName="bg-jii-mint"
              title="Seed measurements"
              subtitle="Create fake pending rows to exercise the upload queue"
              onPress={() => setSeedVisible(true)}
              isLast
            />
          </Card>
        </View>
      ) : null}

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
      {isDev ? (
        <DevSeedMeasurementsDialog visible={seedVisible} onClose={() => setSeedVisible(false)} />
      ) : null}
    </ScrollView>
  );
}

export default ProfileScreen;
