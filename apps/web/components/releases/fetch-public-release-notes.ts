import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import type {
  ComponentReleaseNoteDetailFieldsFragment,
  ComponentReleaseNoteFieldsFragment,
} from "@repo/cms";

/**
 * Public-changelog fetchers for the openjii.org/releases page + per-note detail pages.
 * Unlike the in-app "What's new" feed (which filters by `surfaces`), the public page shows every
 * active note. Wrapped in React `cache()` so `generateMetadata` and the page body share one
 * Contentful request per render (mirrors the blog's getBlogData / getBlogDetailData).
 */

/** All active release notes (no surface filter), newest first. */
export const getAllReleaseNotes = cache(
  async (locale: string, preview: boolean): Promise<ComponentReleaseNoteFieldsFragment[]> => {
    const { previewClient, client } = await getContentfulClients();
    const gqlClient = preview ? previewClient : client;
    const data = await gqlClient.allReleaseNotes({
      preview,
      now: new Date().toISOString(),
      locale,
    });
    return (data.componentReleaseNoteCollection?.items ?? []).filter(
      (item): item is ComponentReleaseNoteFieldsFragment => item !== null,
    );
  },
);

/** A single active release note by slug, or null when none matches. */
export const getReleaseNoteBySlug = cache(
  async (
    locale: string,
    slug: string,
    preview: boolean,
  ): Promise<ComponentReleaseNoteDetailFieldsFragment | null> => {
    const { previewClient, client } = await getContentfulClients();
    const gqlClient = preview ? previewClient : client;
    const data = await gqlClient.releaseNoteBySlug({ slug, locale, preview });
    const entry = data.componentReleaseNoteCollection?.items[0] ?? null;

    // Honor the scheduled `publishedAt` reveal (the list query filters `publishedAt_lte: now`), so a
    // future-dated note isn't reachable early via its direct URL. Draft mode still previews it.
    if (!preview && entry?.publishedAt) {
      const publishedMs = new Date(entry.publishedAt as string).getTime();
      if (!Number.isNaN(publishedMs) && publishedMs > Date.now()) {
        return null;
      }
    }

    return entry;
  },
);
