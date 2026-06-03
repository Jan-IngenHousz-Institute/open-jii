import { ExternalLink, HelpCircle, SlidersHorizontal } from "lucide-react-native";
import React from "react";
import { Linking, Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { getEnvVar } from "~/shared/stores/environment-store";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";

interface ProfileAccountCardProps {
  onOpenAppSettings: () => void;
}

export function ProfileAccountCard({ onOpenAppSettings }: ProfileAccountCardProps) {
  const { t } = useTranslation(["common", "profile"]);

  const openExternal = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      showAlert(t("common:errorTitle"), t("profile:cannotOpenWebProfile"));
    }
  };

  const handleOpenWebProfile = () =>
    openExternal(getEnvVar("NEXT_AUTH_URI") + "/en-US/platform/experiments");

  const handleOpenHelp = () => openExternal("https://docs.openjii.org/docs/introduction/overview");

  return (
    <View className="mb-4">
      <Text className="text-muted-body mb-2 px-1 text-[12px] font-bold uppercase tracking-wider">
        {t("profile:account.section")}
      </Text>
      <Card padded={false}>
        <RowItem
          icon={<SlidersHorizontal size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("profile:account.appSettings")}
          subtitle={t("profile:account.appSettingsSub")}
          onPress={onOpenAppSettings}
        />
        <RowItem
          icon={<HelpCircle size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("profile:account.helpFeedback")}
          onPress={handleOpenHelp}
        />
        <RowItem
          icon={<ExternalLink size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("profile:openWebProfile")}
          subtitle={t("profile:account.openWebProfileSub")}
          onPress={() => void handleOpenWebProfile()}
          isLast
        />
      </Card>
    </View>
  );
}
