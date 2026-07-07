import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";

/** Dispatched (by the footer item or the `G R` shortcut) to open the What's new sheet. */
export const WHATS_NEW_OPEN_EVENT = "openjii:open-whats-new";

/** Number of entries published after the user last opened the panel (null = never → all unread). */
export function countUnread(entries: ReleaseNoteFields[], lastSeenAt: string | null): number {
  if (!lastSeenAt) return entries.length;
  const seenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seenMs)) return entries.length;
  return entries.filter((entry) => {
    if (!entry.publishedAt) return false;
    const publishedMs = new Date(entry.publishedAt as string).getTime();
    return !Number.isNaN(publishedMs) && publishedMs > seenMs;
  }).length;
}
