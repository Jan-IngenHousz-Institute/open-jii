import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { ScanQrCode } from "lucide-react-native";
import React, { forwardRef, useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatJoinCodeInput, parseJoinCodeInput } from "~/features/experiments/domain/join-code";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { QRScannerModal } from "~/shared/ui/qr-scanner/qr-scanner-modal";

export const JoinCodeEntrySheet = forwardRef<BottomSheetModal>(
  function JoinCodeEntrySheet(_props, ref) {
    const themeColors = useThemeColors();
    const { t } = useTranslation(["common", "experiments"]);
    const insets = useSafeAreaInsets();
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );

    const dismiss = () => {
      if (ref && typeof ref !== "function") ref.current?.dismiss();
    };

    const openCode = (raw: string, invalidMessage: string) => {
      const code = parseJoinCodeInput(raw);
      if (!code) {
        setError(invalidMessage);
        return;
      }
      setError(null);
      setValue("");
      dismiss();
      router.push({ pathname: "/join/[code]", params: { code } });
    };

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
        backgroundStyle={{ backgroundColor: themeColors.card }}
        stackBehavior="push"
        keyboardBehavior="interactive"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView className="bg-card px-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 17 }}>
            {t("experiments:joinCode.enterTitle")}
          </Text>
          <Text className="text-muted-body mt-1 text-[12.5px]">
            {t("experiments:joinCode.enterHint")}
          </Text>

          <View className="mt-3">
            <Input
              asBottomSheet
              value={value}
              // OTPInput is digit-only, so the code gets a plain field that
              // groups itself as the student types.
              onChangeText={(raw) => {
                setValue(formatJoinCodeInput(raw));
                setError(null);
              }}
              placeholder={t("experiments:joinCode.placeholder")}
              accessibilityLabel={t("experiments:joinCode.label")}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              error={error ?? undefined}
              containerStyle={{ marginBottom: 0 }}
              style={{ fontFamily: "Overpass-Bold", letterSpacing: 2 }}
            />
          </View>

          <View className="mt-4 gap-2">
            <Button
              title={t("experiments:joinCode.continue")}
              onPress={() => openCode(value, t("experiments:joinCode.invalid"))}
              isDisabled={value.length === 0}
              size="lg"
            />
            <Button
              title={t("experiments:joinCode.scan")}
              accessibilityLabel={t("experiments:joinCode.scan")}
              onPress={() => setIsScanning(true)}
              variant="light"
              icon={<ScanQrCode size={18} color={themeColors.onSurface} />}
            />
            <Button title={t("common:cancel")} onPress={dismiss} variant="ghost" />
          </View>

          <QRScannerModal
            visible={isScanning}
            onClose={() => setIsScanning(false)}
            onScanned={(data) => openCode(data, t("experiments:joinCode.invalidQr"))}
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
