"use client";

import { useWhatsNewLastSeen } from "@/hooks/whats-new/useWhatsNewLastSeen/useWhatsNewLastSeen";
import { Sparkles } from "lucide-react";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { useTranslation } from "@repo/i18n";

import { WHATS_NEW_OPEN_EVENT, countUnread } from "./whats-new-shared";

/**
 * Standalone sidebar-footer row that opens the What's new sheet. Shows a brand-green
 * unread dot when there are new entries. Styled for the dark sidebar (white text), matching the
 * search button above it.
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
      className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hasUnread && (
        <span
          className="bg-jii-bright-green ml-auto size-2 shrink-0 rounded-full"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
