import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useActiveReleaseNotes } from "~/features/release-notes/hooks/use-active-release-notes";
import { tsr } from "~/shared/api/tsr";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms/lib/__generated/sdk";

const LAST_SEEN_QUERY_KEY = ["whats-new", "last-seen"];
const log = createLogger("whats-new");

/** Entries published after the user last opened the panel (null = never → all unread). */
function countUnread(entries: ReleaseNoteFields[], lastSeenAt: string | null): number {
  if (!lastSeenAt) return entries.length;
  const seenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seenMs)) return entries.length;
  return entries.filter((entry) => {
    if (!entry.publishedAt) return false;
    const publishedMs = new Date(entry.publishedAt as string).getTime();
    return !Number.isNaN(publishedMs) && publishedMs > seenMs;
  }).length;
}

interface UseWhatsNewResult {
  entries: ReleaseNoteFields[];
  unreadCount: number;
  /** Stamps "seen" on the backend (cross-device) when there's something unread. */
  markSeen: () => void;
}

/**
 * Combines the Contentful release notes (content) with the backend last-seen timestamp
 * (cross-device unread state) for the mobile "What's new" drawer (OJD-1510). Safe to call from
 * multiple components — React Query dedupes both the Contentful and backend requests.
 */
export function useWhatsNew(): UseWhatsNewResult {
  const { i18n } = useTranslation();
  const entries = useActiveReleaseNotes(i18n.language || "en-US");

  const queryClient = useQueryClient();
  const lastSeenQuery = tsr.users.getWhatsNewSeen.useQuery({
    queryKey: LAST_SEEN_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });
  const markSeenMutation = tsr.users.markWhatsNewSeen.useMutation();

  const lastSeenAt = lastSeenQuery.data?.body.lastSeenAt ?? null;
  const unreadCount = useMemo(() => countUnread(entries, lastSeenAt), [entries, lastSeenAt]);

  const markSeen = () => {
    if (unreadCount === 0) return;
    markSeenMutation.mutate(
      { body: {} },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: LAST_SEEN_QUERY_KEY });
        },
        onError: (error) => {
          // Log quietly rather than surfacing an error to the user.
          log.debug("failed to mark What's new as seen", { error });
        },
      },
    );
  };

  return { entries, unreadCount, markSeen };
}
