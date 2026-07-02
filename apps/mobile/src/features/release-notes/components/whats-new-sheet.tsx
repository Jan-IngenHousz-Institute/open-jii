import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ExternalLink, WifiOff, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWhatsNew } from "~/features/release-notes/hooks/use-whats-new";
import { useWhatsNewSheetStore } from "~/features/release-notes/stores/use-whats-new-sheet-store";
import { useTranslation } from "~/shared/i18n";
import { useEnvVar } from "~/shared/stores/environment-store";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { resolveExternalUrl } from "~/shared/utils/resolve-external-url";

import { WhatsNewFeed } from "./whats-new-feed";

const RELEASES_PATH = "/releases";
const SHEET_TOP_GAP = 4;

/** Shown when release notes can't be fetched because the device is offline (and none are cached). */
function WhatsNewOfflineState() {
  const { t } = useTranslation("whatsNew");
  const themeColors = useThemeColors();
  return (
    <View className="items-center gap-3 px-6 py-16">
      <View className="border-border h-16 w-16 items-center justify-center rounded-full border">
        <WifiOff size={28} color={themeColors.inactive} />
      </View>
      <Text
        className="text-on-surface text-center"
        style={{ fontFamily: "Poppins-SemiBold", fontSize: 16 }}
      >
        {t("offline.title")}
      </Text>
      <Text className="text-muted-body text-center text-sm leading-5">{t("offline.subtitle")}</Text>
    </View>
  );
}

/** Full-screen What's new drawer; mirrors the device sheet's store/ref pattern. */
export function WhatsNewSheet() {
  const isOpen = useWhatsNewSheetStore((s) => s.isOpen);
  const close = useWhatsNewSheetStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { t } = useTranslation("whatsNew");
  const sheetRef = useRef<BottomSheetModal>(null);
  const { entries, markSeen } = useWhatsNew();
  // Offline is read from the shared connectivity hook, not useWhatsNew — the feed hook is untouched.
  // Undefined (first probe) is treated as online so we never flash the offline state on open.
  const { data: online } = useIsOnline();
  const isOffline = online === false;
  const webBaseUrl = useEnvVar("NEXT_AUTH_URI");
  const releaseNotesBaseUrl = useMemo(
    () => resolveExternalUrl(RELEASES_PATH, webBaseUrl),
    [webBaseUrl],
  );
  const snapPoints = useMemo(() => ["100%"], []);

  useEffect(() => {
    if (isOpen) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  // Closing the panel stamps "seen" so the unread dot clears across devices.
  const handleDismiss = useCallback(() => {
    close();
    markSeen();
  }, [close, markSeen]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.background }}
      topInset={insets.top + SHEET_TOP_GAP}
    >
      <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-1">
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("title")}
        </Text>
        <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8} className="p-1">
          <X size={22} color={themeColors.onSurface} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        {isOffline && entries.length === 0 ? (
          <WhatsNewOfflineState />
        ) : (
          <WhatsNewFeed entries={entries} linkBaseHref={releaseNotesBaseUrl} />
        )}
      </BottomSheetScrollView>

      <View
        className="border-border bg-card border-t px-4 py-3"
        style={{ paddingBottom: insets.bottom, minHeight: insets.bottom + 64 }}
      >
        <Pressable
          onPress={() => void Linking.openURL(releaseNotesBaseUrl)}
          hitSlop={6}
          className="flex-row items-center gap-1.5 self-start"
        >
          <Text className="text-primary text-sm font-semibold">{t("fullChangelog")}</Text>
          <ExternalLink size={14} color={themeColors.brand} />
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}
