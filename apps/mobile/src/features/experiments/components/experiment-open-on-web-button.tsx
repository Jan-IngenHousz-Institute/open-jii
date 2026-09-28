import { ExternalLink } from "lucide-react-native";
import React from "react";
import { Linking, Pressable } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { getEnvVar } from "~/shared/stores/environment-store";
import { showAlert } from "~/shared/ui/AlertDialog";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface ExperimentOpenOnWebButtonProps {
  experimentId: string;
  color?: string;
  size?: number;
}

export function ExperimentOpenOnWebButton({
  experimentId,
  color,
  size = 18,
}: ExperimentOpenOnWebButtonProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "experiments"]);

  const openOnWeb = async () => {
    const url = `${getEnvVar("NEXT_AUTH_URI")}/en-US/platform/experiments/${experimentId}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("cannot open");
      await Linking.openURL(url);
    } catch {
      showAlert(t("common:errorTitle"), t("experiments:detail.openWebUnavailable"));
    }
  };

  return (
    <Pressable
      onPress={() => void openOnWeb()}
      accessibilityRole="button"
      accessibilityLabel={t("experiments:detail.openWeb")}
      className="p-2 active:opacity-60"
    >
      <ExternalLink size={size} color={color ?? themeColors.inactive} />
    </Pressable>
  );
}
