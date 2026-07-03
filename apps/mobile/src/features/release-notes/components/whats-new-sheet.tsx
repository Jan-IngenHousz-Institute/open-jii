import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { ExternalLink, FileText, WifiOff, X } from "lucide-react-native";
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

/** Shown when there are no release notes available yet. */
function WhatsNewEmptyState() {
  const { t } = useTranslation("whatsNew");
  const themeColors = useThemeColors();
  return (
    <View className="items-center gap-3 px-6 py-16">
      <View className="border-border h-16 w-16 items-center justify-center rounded-full border">
        <FileText size={28} color={themeColors.inactive} />
      </View>
      <Text
        className="text-on-surface text-center"
        style={{ fontFamily: "Poppins-SemiBold", fontSize: 16 }}
      >
        {t("empty")}
      </Text>
      <Text className="text-muted-body text-center text-sm leading-5">{t("emptySubtitle")}</Text>
    </View>
  );
}

/** Content-sized What's new drawer; mirrors the device sheet's store/ref pattern. */
export function WhatsNewSheet() {
  const isOpen = useWhatsNewSheetStore((s) => s.isOpen);
  const close = useWhatsNewSheetStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { t } = useTranslation("whatsNew");
  const sheetRef = useRef<BottomSheetModal>(null);
  const { entries, markSeen } = useWhatsNew();
  const hasEntries = entries.length > 0;
  // Offline is read from the shared connectivity hook, not useWhatsNew — the feed hook is untouched.
  // Undefined (first probe) is treated as online so we never flash the offline state on open.
  const { data: online } = useIsOnline();
  const isOffline = online === false;
  const webBaseUrl = useEnvVar("NEXT_AUTH_URI");
  const releaseNotesBaseUrl = useMemo(
    () => resolveExternalUrl(RELEASES_PATH, webBaseUrl),
    [webBaseUrl],
  );
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

  // Header lives in the handle so dynamic sizing counts its height (only the
  // handle and the scrollable's content are measured; sibling views are not).
  const renderHandle = useCallback(
    () => (
      <View>
        <View className="items-center pb-1 pt-2.5">
          <View
            style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: themeColors.inactive }}
          />
        </View>
        <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-1">
          <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
            {t("title")}
          </Text>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8} className="p-1">
            <X size={22} color={themeColors.onSurface} />
          </Pressable>
        </View>
      </View>
    ),
    [t, themeColors],
  );

  // Rendered via footerComponent (with enableFooterMarginAdjustment on the
  // scroll view) so its height is padded into the content and measured too.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          className="border-border bg-card border-t px-6 py-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
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
      </BottomSheetFooter>
    ),
    [insets.bottom, releaseNotesBaseUrl, t, themeColors],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      handleComponent={renderHandle}
      footerComponent={renderFooter}
      backgroundStyle={{ backgroundColor: themeColors.background }}
      topInset={insets.top + SHEET_TOP_GAP}
    >
      <BottomSheetScrollView
        enableFooterMarginAdjustment
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        {isOffline && !hasEntries ? (
          <WhatsNewOfflineState />
        ) : !hasEntries ? (
          <WhatsNewEmptyState />
        ) : (
          <WhatsNewFeed entries={entries} linkBaseHref={releaseNotesBaseUrl} />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
