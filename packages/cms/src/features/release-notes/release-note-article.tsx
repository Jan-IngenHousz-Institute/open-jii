"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "../../lib/__generated/sdk";
import { CtfRichText, type EmbeddedEntryType } from "../contentful/ctf-rich-text";
import { ReleaseHero } from "./release-hero";

interface ReleaseNoteArticleProps {
  entry: ReleaseNoteFields;
}

/**
 * Full single release-note render for the public /releases/[slug] detail page (OJD-1394).
 * The top reuses the shared `ReleaseHero` (same split card as the /releases index hero) as an
 * <h1> with no "Read more" self-link, then renders the full rich-text body below it. Wired for
 * Contentful draft preview + live updates + inspector (click-to-edit) on the body, matching how
 * the blog's ArticleContent works (provider is mounted in [locale]/layout.tsx).
 */
export const ReleaseNoteArticle: React.FC<ReleaseNoteArticleProps> = ({ entry }) => {
  // Live updates reflect unpublished edits in the Contentful preview iframe in real time.
  const live = useContentfulLiveUpdates(entry) as Omit<ReleaseNoteFields, "body"> & {
    body?: { json: Document; links: { entries: { block: EmbeddedEntryType[] } } } | null;
  };
  const inspectorProps = useContentfulInspectorMode({ entryId: entry.sys.id });

  return (
    <article className="flex flex-col gap-8 lg:gap-10">
      <ReleaseHero entry={entry} headingLevel="h1" showReadMore={false} />

      {live.body?.json && (
        <div className="max-w-none" {...inspectorProps({ fieldId: "body" })}>
          <CtfRichText json={live.body.json as Document} links={live.body.links} />
        </div>
      )}
    </article>
  );
};
