import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";

/** Dispatched (by the footer item or the `G R` shortcut) to open the What's new sheet. */
export const WHATS_NEW_OPEN_EVENT = "openjii:open-whats-new";

/** When each note was published, which is all the unread dot needs before the sheet opens. */
export function publishedDates(entries: ReleaseNoteFields[]): string[] {
  return entries.flatMap((entry) =>
    typeof entry.publishedAt === "string" ? [entry.publishedAt] : [],
  );
}

/** Number of notes published after the user last opened the panel (null = never → all unread). */
export function countUnread(dates: string[], lastSeenAt: string | null): number {
  if (!lastSeenAt) return dates.length;
  const seenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seenMs)) return dates.length;
  return dates.filter((date) => {
    const publishedMs = new Date(date).getTime();
    return !Number.isNaN(publishedMs) && publishedMs > seenMs;
  }).length;
}
