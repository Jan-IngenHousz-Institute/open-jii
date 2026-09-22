"use client";

import { sidebarUtilityRow } from "@/components/navigation/navigation-sidebar/sidebar-utility-row";
import { useWhatsNewLastSeen } from "@/hooks/whats-new/useWhatsNewLastSeen/useWhatsNewLastSeen";
import { Sparkles } from "lucide-react";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { useTranslation } from "@repo/i18n";

import { WHATS_NEW_OPEN_EVENT, countUnread } from "./whats-new-shared";

/**
 * Row that opens the What's new sheet from the sidebar's secondary navigation
 * group. It shares the same navigation-row treatment as Activity and
 * Documentation, and shows an accent dot when there are new entries.
 */
export function WhatsNewFooterItem({
  entries,
  onOpen,
}: {
  entries: ReleaseNoteFields[];
  onOpen?: () => void;
}) {
  const { t } = useTranslation("navigation");
  const lastSeen = useWhatsNewLastSeen();
  // Wait for the query to resolve — treating a loading `undefined` as "never seen" flashes every
  // note as unread. A resolved null `lastSeenAt` still correctly means all unread.
  const unreadCount = lastSeen.data ? countUnread(entries, lastSeen.data.lastSeenAt) : 0;
  const hasUnread = unreadCount > 0;
  const label = t("whatsNew.navLabel");

  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));
      }}
      aria-label={
        hasUnread ? `${label} (${t("whatsNew.unreadBadge", { count: unreadCount })})` : label
      }
      className={sidebarUtilityRow()}
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {hasUnread && (
        <span className="bg-primary ml-auto size-2 shrink-0 rounded-full" aria-hidden="true" />
      )}
    </button>
  );
}
