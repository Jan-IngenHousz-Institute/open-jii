import { ExternalLink } from "lucide-react-native";
import React from "react";
import { Linking, Pressable } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { getEnvVar } from "~/shared/stores/environment-store";
import { showAlert } from "~/shared/ui/AlertDialog";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface OrganizationOpenOnWebButtonProps {
  organizationId: string;
  color?: string;
  size?: number;
}

export function OrganizationOpenOnWebButton({
  organizationId,
  color,
  size = 18,
}: OrganizationOpenOnWebButtonProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "organizations"]);

  const openOnWeb = async () => {
    const url = `${getEnvVar("NEXT_AUTH_URI")}/en-US/platform/organizations/${organizationId}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      showAlert(t("common:errorTitle"), t("organizations:openOnWebUnavailable"));
    }
  };

  return (
    <Pressable
      onPress={() => void openOnWeb()}
      accessibilityRole="button"
      accessibilityLabel={t("organizations:openOnWeb")}
      className="p-2 active:opacity-60"
    >
      <ExternalLink size={size} color={color ?? themeColors.inactive} />
    </Pressable>
  );
}
