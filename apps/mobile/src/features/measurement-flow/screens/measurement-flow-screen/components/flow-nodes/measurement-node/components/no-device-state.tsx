import React, { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { BackButton } from "~/features/measurement-flow/screens/measurement-flow-screen/components/back-button";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

export function NoDeviceState() {
  const { t } = useTranslation("measurementFlow");
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);
  const previousStep = useMeasurementFlowStore((s) => s.previousStep);

  // Auto-open the connect overlay once when this state first appears. The ref
  // guard keeps the 3s connected-device poll re-renders from re-opening it; a
  // fresh disconnect remounts the component (new ref), so it opens again then.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openDeviceSheet();
  }, [openDeviceSheet]);

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-muted-foreground text-center text-sm">
          {t("measurementFlow:measurementNode.noDevice.connectFirst")}
        </Text>
      </View>
      <View className="flex-row items-center justify-between px-4 py-3">
        <BackButton onPress={previousStep} />
        <Button
          title={t("measurementFlow:measurementNode.connectToDevice")}
          onPress={openDeviceSheet}
          style={{ height: 44 }}
        />
      </View>
    </View>
  );
}
