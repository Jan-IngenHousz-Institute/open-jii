"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { ArrowRight } from "lucide-react";
import React from "react";

import { useCurrentLocale, useTranslation } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "../../lib/__generated/sdk";
import { isVideoAsset } from "../contentful/ctf-video";
import { getCategoryMeta } from "./category";

interface ReleaseFeatureProps {
  entry: ReleaseNoteFields;
  /** Base path for the detail link; the hero links to `${linkBaseHref}/${slug}`. */
  linkBaseHref?: string;
  /** Target for the detail link (default same-tab). */
  linkTarget?: "_blank" | "_self";
}

/** Absolute publish date ("July 1, 2026") — matches the /releases/[slug] article header. */
function formatDate(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

/**
 * Spotlights the newest release note at the top of the public /releases page (OJD-1394) — the
 * changelog's answer to the blog's featured ArticleHero: a large split card, media on one side and
 * title/summary/CTA on the other. Falls back to a full-width, text-forward layout when the note has
 * no media, so a media-less release still reads as intentional rather than broken.
 */
export const ReleaseFeature: React.FC<ReleaseFeatureProps> = ({
  entry,
  linkBaseHref,
  linkTarget = "_self",
}) => {
  const { t } = useTranslation("navigation");
  const locale = useCurrentLocale(i18nConfig) ?? "en-US";

  const live = useContentfulLiveUpdates(entry);
  const inspectorProps = useContentfulInspectorMode({ entryId: entry.sys.id });

  const category = getCategoryMeta(live.category);
  const media = live.media;
  const hasMedia = Boolean(media?.url);
  const isImage = hasMedia && !isVideoAsset(media?.contentType);
  const dateLabel = live.publishedAt ? formatDate(live.publishedAt as string, locale) : null;

  const href = linkBaseHref && live.slug ? `${linkBaseHref}/${live.slug}` : undefined;
  const linkRel = linkTarget === "_blank" ? "noopener noreferrer" : undefined;

  return (
    <article
      className={cn(
        "border-border grid overflow-hidden rounded-2xl border bg-white shadow-sm",
        hasMedia && "lg:grid-cols-2",
      )}
    >
      {hasMedia && (
        <div
          className="bg-primary/5 relative min-h-56 lg:min-h-full"
          {...inspectorProps({ fieldId: "media" })}
        >
          {isImage ? (
            <img
              src={`${media?.url}?w=1200&fm=webp&fit=fill`}
              alt={media?.description ?? media?.title ?? live.title ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={media?.url ?? undefined}
              title={media?.title ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            >
              {media?.contentType && (
                <source src={media?.url ?? undefined} type={media.contentType} />
              )}
            </video>
          )}
        </div>
      )}

      <div className="flex flex-col justify-center gap-4 p-8 lg:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={category.badgeClassName} {...inspectorProps({ fieldId: "category" })}>
            {t(category.labelKey)}
          </Badge>
          {dateLabel && (
            <span
              className="text-muted-foreground font-mono text-xs tabular-nums"
              {...inspectorProps({ fieldId: "publishedAt" })}
            >
              {dateLabel}
            </span>
          )}
        </div>

        <h2
          className="text-foreground text-2xl font-semibold leading-tight tracking-tight md:text-3xl"
          {...inspectorProps({ fieldId: "title" })}
        >
          {href ? (
            <a
              href={href}
              target={linkTarget}
              rel={linkRel}
              className="hover:text-primary transition-colors"
            >
              {live.title}
            </a>
          ) : (
            live.title
          )}
        </h2>

        {live.summary && (
          <p
            className="text-muted-foreground text-base"
            {...inspectorProps({ fieldId: "summary" })}
          >
            {live.summary}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {href && (
            <a
              href={href}
              target={linkTarget}
              rel={linkRel}
              className="bg-primary text-primary-foreground hover:bg-primary-light inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
              {t("whatsNew.readMore")}
              <ArrowRight className="size-3.5" />
            </a>
          )}
          {live.cta?.url && live.cta.label && (
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="w-fit"
              {...inspectorProps({ fieldId: "cta" })}
            >
              <a href={live.cta.url} target="_blank" rel="noopener noreferrer">
                {live.cta.label}
                <ArrowRight className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};
