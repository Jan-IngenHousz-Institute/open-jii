import { ChevronRight, Sparkles } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useWhatsNew } from "~/features/release-notes/hooks/use-whats-new";
import { useWhatsNewSheetStore } from "~/features/release-notes/stores/use-whats-new-sheet-store";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

/**
 * Home-screen entry point for the What's new drawer: a card that communicates whether
 * there are unread release notes (brand-green dot + count) and opens the shared sheet on tap.
 * Mirrors HomeDeviceCard's layout/store pattern.
 */
export function HomeWhatsNewCard() {
  const { t } = useTranslation("whatsNew");
  const themeColors = useThemeColors();
  const { unreadCount } = useWhatsNew();
  const hasUnread = unreadCount > 0;

  const onPress = () => useWhatsNewSheetStore.getState().open();

  const subtitle = hasUnread
    ? t("card.subtitleUnread", { count: unreadCount })
    : t("card.subtitleCaughtUp");

  return (
    <Pressable onPress={onPress} className="mb-1 mt-3" accessibilityRole="button">
      <View className="bg-card shadow-xs rounded-2xl p-3.5 shadow-black/10">
        <View className="flex-row items-center">
          <View className="bg-jii-mint h-13 w-13 relative mr-3 items-center justify-center rounded-[14px]">
            <Sparkles size={26} color={themeColors.brand} />
            {hasUnread ? (
              <View className="bg-jii-primary-bright absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white" />
            ) : null}
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="text-on-surface text-[15px]"
              style={{ fontFamily: "Poppins-Bold" }}
              numberOfLines={1}
            >
              {t("card.title")}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <ChevronRight size={20} color={themeColors.inactive} />
        </View>
      </View>
    </Pressable>
  );
}
