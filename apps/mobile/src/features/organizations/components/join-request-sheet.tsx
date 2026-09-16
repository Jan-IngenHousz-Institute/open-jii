import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  JOIN_MESSAGE_MAX_LENGTH,
  normalizeJoinMessage,
} from "~/features/organizations/domain/join-message";
import { useRequestJoinOrganization } from "~/features/organizations/hooks/use-request-join-organization";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface JoinRequestSheetProps {
  organizationId: string;
  organizationName: string;
}

export const JoinRequestSheet = forwardRef<BottomSheetModal, JoinRequestSheetProps>(
  function JoinRequestSheet({ organizationId, organizationName }, ref) {
    const themeColors = useThemeColors();
    const { t } = useTranslation(["common", "organizations"]);
    const insets = useSafeAreaInsets();
    const [message, setMessage] = useState("");
    const { requestJoin, isPending } = useRequestJoinOrganization(organizationName);
    // Connectivity can drop after the CTA opened this sheet; an offlineFirst
    // mutation submitted then pauses and fires by itself on reconnect.
    const { data: online } = useIsOnline();
    const isOffline = online === false;

    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );

    const dismiss = () => {
      if (ref && typeof ref !== "function") ref.current?.dismiss();
    };

    const send = () => {
      if (isOffline || isPending) return;
      requestJoin(
        { id: organizationId, message: normalizeJoinMessage(message) },
        // No onError: the hook owns the toast, and a failure must leave the
        // sheet open with the message intact so the user can retry.
        {
          onSuccess: () => {
            setMessage("");
            dismiss();
          },
        },
      );
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
            {t("organizations:join.sheetTitle", { name: organizationName })}
          </Text>
          <Text className="text-muted-body mt-1 text-[12.5px]">
            {t("organizations:join.sheetHint")}
          </Text>

          <View className="mt-3">
            <Input
              asBottomSheet
              value={message}
              onChangeText={setMessage}
              placeholder={t("organizations:join.messagePlaceholder")}
              accessibilityLabel={t("organizations:join.sheetHint")}
              multiline
              numberOfLines={4}
              maxLength={JOIN_MESSAGE_MAX_LENGTH}
              editable={!isPending}
              textAlignVertical="top"
              containerStyle={{ marginBottom: 0 }}
              style={{ height: 88 }}
            />
            <Text className="text-muted-body mt-1 text-right text-[11px]">
              {t("organizations:join.messageCounter", {
                n: message.length,
                max: JOIN_MESSAGE_MAX_LENGTH,
              })}
            </Text>
          </View>

          <View className="mt-4 gap-2">
            <Button
              title={isPending ? t("organizations:join.sending") : t("organizations:join.send")}
              onPress={send}
              isLoading={isPending}
              isDisabled={isPending || isOffline}
              size="lg"
            />
            {isOffline ? (
              <Text className="text-muted-body text-center text-[12px]">
                {t("organizations:join.offlineHint")}
              </Text>
            ) : null}
            <Button
              title={t("common:cancel")}
              onPress={dismiss}
              variant="light"
              isDisabled={isPending}
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
