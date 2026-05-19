import React from "react";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Button } from "~/shared/ui/Button";

interface EndFlowButtonProps {
  onPress: () => void;
}

export function EndFlowButton({ onPress }: EndFlowButtonProps) {
  const { t } = useTranslation(["common", "measurementFlow"]);

  const handlePress = () => {
    showAlert(t("measurementFlow:endFlow.alertTitle"), t("measurementFlow:endFlow.alertMessage"), [
      {
        text: t("measurementFlow:endFlow.confirm"),
        variant: "primary",
        onPress: onPress,
      },
      {
        text: t("common:continue"),
        variant: "ghost",
      },
    ]);
  };

  return (
    <Button
      title={t("measurementFlow:endFlow.buttonTitle")}
      onPress={handlePress}
      variant="light"
      style={{ height: 32, paddingTop: 0, paddingBottom: 0 }}
    />
  );
}
