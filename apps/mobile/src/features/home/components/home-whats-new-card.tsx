import { Sparkles } from "lucide-react-native";
import React from "react";
import { HomeNavCard } from "~/features/home/components/home-nav-card";
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
    <HomeNavCard
      icon={<Sparkles size={26} color={themeColors.brand} />}
      badge={hasUnread ? "top-right" : undefined}
      badgeClassName="bg-jii-primary-bright"
      title={t("card.title")}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
}
