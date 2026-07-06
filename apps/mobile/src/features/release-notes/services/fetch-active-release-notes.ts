import { getContentfulClient } from "~/shared/api/contentful-client";

import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms/lib/__generated/sdk";

export async function fetchActiveReleaseNotes(
  locale: string,
): Promise<ComponentReleaseNoteFieldsFragment[]> {
  const client = getContentfulClient();
  if (!client) return [];

  try {
    const data = await client.activeReleaseNotes({
      preview: false,
      now: new Date().toISOString(),
      locale,
      surfaces: ["mobile", "both"],
    });

    return (data.componentReleaseNoteCollection?.items ?? []).filter(
      (item): item is ComponentReleaseNoteFieldsFragment => item !== null,
    );
  } catch (error) {
    // Fail-safe: degrade to an empty feed rather than surfacing a global error toast.
    console.warn("[contentful] failed to fetch release notes:", error);
    return [];
  }
}
