"use client";

import { useWhatsNewLastSeen } from "@/hooks/whats-new/useWhatsNewLastSeen/useWhatsNewLastSeen";
import { Sparkles } from "lucide-react";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { WHATS_NEW_OPEN_EVENT, countUnread } from "./whats-new-shared";

/**
 * Row that opens the What's new sheet, in the sidebar footer and in the mobile nav
 * sheet. Shaped like a stock sidebar row but not built from one — the mobile sheet
 * is not inside a `Sidebar`, so `SidebarMenuButton` would throw there. Shows an accent
 * unread dot when there are new entries.
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
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));
      }}
      aria-label={
        hasUnread ? `${label} (${t("whatsNew.unreadBadge", { count: unreadCount })})` : label
      }
      className="h-8 w-full justify-start gap-2 p-2 font-normal"
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {hasUnread && (
        <span className="bg-primary ml-auto size-2 shrink-0 rounded-full" aria-hidden="true" />
      )}
    </Button>
  );
}
