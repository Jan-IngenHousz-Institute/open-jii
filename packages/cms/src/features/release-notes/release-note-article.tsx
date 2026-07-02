"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import { ArrowRight } from "lucide-react";
import React from "react";

import { useCurrentLocale, useTranslation } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "../../lib/__generated/sdk";
import { CtfRichText } from "../contentful/ctf-rich-text";
import { isVideoAsset } from "../contentful/ctf-video";
import { getCategoryMeta } from "./category";

interface ReleaseNoteArticleProps {
  entry: ReleaseNoteFields;
}

/** Absolute publish date ("June 30, 2026"); better than relative time on a permalink page. */
function formatAbsoluteDate(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

/**
 * Full single release-note render for the public /releases/[slug] detail page (OJD-1394).
 * Shares the category + rich-text + media helpers with the in-app feed entry, but lays the note
 * out as a full article. Wired for Contentful draft preview + live updates + inspector (click-to-edit),
 * the same way the blog's ArticleContent/ArticleHero are (provider is mounted in [locale]/layout.tsx).
 */
export const ReleaseNoteArticle: React.FC<ReleaseNoteArticleProps> = ({ entry }) => {
  const { t } = useTranslation("navigation");
  const locale = useCurrentLocale(i18nConfig) ?? "en-US";

  // Live updates reflect unpublished edits in the Contentful preview iframe in real time.
  const live = useContentfulLiveUpdates(entry);
  const inspectorProps = useContentfulInspectorMode({ entryId: entry.sys.id });

  const category = getCategoryMeta(live.category);
  const media = live.media;
  const publishedLabel = live.publishedAt
    ? formatAbsoluteDate(live.publishedAt as string, locale)
    : null;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={category.badgeClassName} {...inspectorProps({ fieldId: "category" })}>
            {t(category.labelKey)}
          </Badge>
          {publishedLabel && (
            <span
              className="text-muted-foreground text-sm"
              {...inspectorProps({ fieldId: "publishedAt" })}
            >
              {publishedLabel}
            </span>
          )}
        </div>
        <h1
          className="text-foreground text-3xl font-semibold leading-tight md:text-4xl"
          {...inspectorProps({ fieldId: "title" })}
        >
          {live.title}
        </h1>
        {live.summary && (
          <p className="text-muted-foreground text-lg" {...inspectorProps({ fieldId: "summary" })}>
            {live.summary}
          </p>
        )}
      </header>

      {media?.url && (
        <div {...inspectorProps({ fieldId: "media" })}>
          {isVideoAsset(media.contentType) ? (
            <video
              src={media.url}
              title={media.title ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl object-cover"
            >
              {media.contentType && <source src={media.url} type={media.contentType} />}
            </video>
          ) : (
            <img
              src={`${media.url}?w=1280&fm=webp&fit=fill`}
              alt={media.description ?? media.title ?? live.title ?? ""}
              className="aspect-video w-full rounded-xl object-cover"
            />
          )}
        </div>
      )}

      {live.body?.json && (
        <div className="max-w-none" {...inspectorProps({ fieldId: "body" })}>
          <CtfRichText json={live.body.json as Document} />
        </div>
      )}

      {live.cta?.url && live.cta.label && (
        <Button asChild className="w-fit" {...inspectorProps({ fieldId: "cta" })}>
          <a href={live.cta.url} target="_blank" rel="noopener noreferrer">
            {live.cta.label}
            <ArrowRight className="size-4" />
          </a>
        </Button>
      )}
    </article>
  );
};
