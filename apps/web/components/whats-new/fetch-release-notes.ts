import { unstable_cache } from "next/cache";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";

import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms";

const getCachedReleaseNotes = unstable_cache(
  async (locale: string): Promise<ComponentReleaseNoteFieldsFragment[]> => {
    const { client } = await getContentfulClients();
    const data = await client.activeReleaseNotes({
      preview: false,
      now: new Date().toISOString(),
      locale,
      surfaces: ["web", "both"],
    });
    return (data.componentReleaseNoteCollection?.items ?? []).filter(
      (item): item is ComponentReleaseNoteFieldsFragment => item !== null,
    );
  },
  ["whats-new-release-notes"],
  { revalidate: PUBLISHED_CONTENT_SECONDS },
);

/**
 * Fetches active web release notes for the "What's new" panel. Fail-safe: returns an
 * empty list on any Contentful error, so the platform layout never breaks.
 */
export async function fetchWebReleaseNotes(
  locale: string,
): Promise<ComponentReleaseNoteFieldsFragment[]> {
  try {
    return await getCachedReleaseNotes(locale);
  } catch {
    return [];
  }
}
