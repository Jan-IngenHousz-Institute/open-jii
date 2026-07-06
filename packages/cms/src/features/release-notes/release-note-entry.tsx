"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import { ArrowRight } from "lucide-react";
import React, { useState } from "react";

import { useCurrentLocale, useTranslation } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "../../lib/__generated/sdk";
import { CtfRichText, type EmbeddedEntryType } from "../contentful/ctf-rich-text";
import { isVideoAsset } from "../contentful/ctf-video";
import { getCategoryMeta } from "./category";
import { SurfaceBadges } from "./surface-badges";

interface ReleaseNoteEntryProps {
  entry: ReleaseNoteFields;
  /**
   * Base path/URL for the detail page; the entry links to `${linkBaseHref}/${slug}` ("Read more →")
   * instead of expanding the body inline. A plain string (not a function) so it can cross the
   * Server→Client component boundary. Omitted, or an entry without a slug, keeps the inline-expand
   * fallback. e.g. `/en-US/releases` (public list) or `https://openjii.org/releases` (in-app sheet).
   */
  linkBaseHref?: string;
  /** Target for the detail link; `_blank` (e.g. from the in-app sheet to the public site) gets rel=noopener. */
  linkTarget?: "_blank" | "_self";
  /** Visual treatment for the entry. `sheet` is denser and card-like for the What's new drawer. */
  variant?: "default" | "sheet";
  /**
   * `default` (timeline) variant only: when true, this is the last node in its month group, so the
   * vertical rail connector below the dot is omitted. Ignored by the `sheet` variant.
   */
  isLast?: boolean;
}

/** Builds a short relative-time label ("3 days ago") with no extra deps. */
function formatRelativeTime(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;

  const diffSec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

/** Compact absolute date ("Jul 1, 2026") — better than relative time on the dated public timeline. */
function formatShortDate(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

export const ReleaseNoteEntry: React.FC<ReleaseNoteEntryProps> = ({
  entry,
  linkBaseHref,
  linkTarget = "_self",
  variant = "default",
  isLast = false,
}) => {
  const { t } = useTranslation("navigation");
  const locale = useCurrentLocale(i18nConfig) ?? "en-US";
  const [expanded, setExpanded] = useState(false);

  // Live updates reflect unpublished edits in the Contentful preview iframe in real time; inspector
  // props add click-to-edit overlays. No-ops outside preview. Mirrors the blog's ArticleTile.
  const live = useContentfulLiveUpdates(entry) as Omit<ReleaseNoteFields, "body"> & {
    body?: { json: Document; links: { entries: { block: EmbeddedEntryType[] } } } | null;
  };
  const inspectorProps = useContentfulInspectorMode({ entryId: entry.sys.id });

  const category = getCategoryMeta(live.category);
  const media = live.media;
  const relativeTime = live.publishedAt
    ? formatRelativeTime(live.publishedAt as string, locale)
    : null;

  const href = linkBaseHref && live.slug ? `${linkBaseHref}/${live.slug}` : undefined;
  const linkRel = linkTarget === "_blank" ? "noopener noreferrer" : undefined;
  const isSheet = variant === "sheet";

  if (!isSheet) {
    // Public /releases timeline node (OJD-1394): a category-colored rail dot + connector, then the
    // note's metadata, title, summary and an optional thumbnail. The rail is what separates this
    // changelog from the blog's photo-tile grid. The optional CTA sits next to Read more as a
    // secondary outline button, mirroring the featured hero.
    const dateLabel = live.publishedAt ? formatShortDate(live.publishedAt as string, locale) : null;
    const isImage = Boolean(media?.url) && !isVideoAsset(media?.contentType);
    const canExpand = !href && Boolean(live.body?.json);
    const hasCta = Boolean(live.cta?.url && live.cta.label);

    return (
      <article className="relative flex gap-4">
        {/* rail: category dot + connector down to the next node (omitted on a group's last node) */}
        <div className="relative flex w-3.5 flex-none flex-col items-center" aria-hidden="true">
          <span
            className={cn(
              "ring-background mt-1.5 size-3.5 flex-none rounded-full ring-4",
              category.dotClassName,
            )}
          />
          {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
        </div>

        <div className="flex flex-1 gap-5 pb-9">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                className={category.badgeClassName}
                {...inspectorProps({ fieldId: "category" })}
              >
                {t(category.labelKey)}
              </Badge>
              <SurfaceBadges
                surfaces={live.surfaces}
                inspectorProps={inspectorProps({ fieldId: "surfaces" })}
              />
              {dateLabel && (
                <span
                  className="text-muted-foreground font-mono text-xs tabular-nums"
                  {...inspectorProps({ fieldId: "publishedAt" })}
                >
                  {dateLabel}
                </span>
              )}
            </div>

            <h3
              className="text-foreground text-lg font-semibold leading-snug"
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
            </h3>

            {live.summary && (
              <p
                className="text-muted-foreground text-sm"
                {...inspectorProps({ fieldId: "summary" })}
              >
                {live.summary}
              </p>
            )}

            {(canExpand || hasCta || Boolean(href)) && (
              <div className="mt-0.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  {href ? (
                    <a
                      href={href}
                      target={linkTarget}
                      rel={linkRel}
                      className="text-primary inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {t("whatsNew.readMore")}
                      <ArrowRight className="size-3.5" />
                    </a>
                  ) : (
                    canExpand && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="text-primary w-fit text-sm font-medium hover:underline"
                        aria-expanded={expanded}
                      >
                        {expanded ? t("whatsNew.showLess") : t("whatsNew.showMore")}
                      </button>
                    )
                  )}

                  {hasCta && (
                    <a
                      href={live.cta?.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm transition-colors"
                      {...inspectorProps({ fieldId: "cta" })}
                    >
                      {live.cta?.label}
                      <ArrowRight className="size-3.5" />
                    </a>
                  )}
                </div>

                {canExpand && expanded && (
                  <div className="text-sm [&_*]:text-sm" {...inspectorProps({ fieldId: "body" })}>
                    <CtfRichText json={live.body?.json as Document} links={live.body?.links} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional thumbnail — video notes keep a looping preview, images get a fixed crop. */}
          {media?.url && (
            <div
              className="hidden h-24 w-40 flex-none overflow-hidden rounded-lg sm:block"
              {...inspectorProps({ fieldId: "media" })}
            >
              {isImage ? (
                <img
                  src={`${media.url}?w=480&h=288&fm=webp&fit=fill`}
                  alt={media.description ?? media.title ?? live.title ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={media.url}
                  title={media.title ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                >
                  {media.contentType && <source src={media.url} type={media.contentType} />}
                </video>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="border-border bg-card shadow-xs hover:border-primary/30 overflow-hidden rounded-lg border transition-colors">
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
              className="aspect-video w-full object-cover"
            >
              {media.contentType && <source src={media.url} type={media.contentType} />}
            </video>
          ) : (
            <img
              src={`${media.url}?w=960&fm=webp&fit=fill`}
              alt={media.description ?? media.title ?? live.title ?? ""}
              loading="lazy"
              className="aspect-video w-full object-cover"
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <Badge
            className={cn("shrink-0", category.badgeClassName)}
            {...inspectorProps({ fieldId: "category" })}
          >
            {t(category.labelKey)}
          </Badge>
          {relativeTime && (
            <p
              className="text-muted-foreground text-xs"
              {...inspectorProps({ fieldId: "publishedAt" })}
            >
              {relativeTime}
            </p>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-foreground flex-1 text-[15px] font-semibold leading-snug"
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
          </h3>
        </div>

        {live.summary && (
          <p
            className="text-muted-foreground text-sm leading-5"
            {...inspectorProps({ fieldId: "summary" })}
          >
            {live.summary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {href ? (
            <a
              href={href}
              target={linkTarget}
              rel={linkRel}
              className="bg-primary text-primary-foreground hover:bg-primary-light inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
              {t("whatsNew.readMore")}
              <ArrowRight className="size-3.5" />
            </a>
          ) : (
            live.body?.json && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-primary hover:bg-primary/10 w-fit rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                aria-expanded={expanded}
              >
                {expanded ? t("whatsNew.showLess") : t("whatsNew.showMore")}
              </button>
            )
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

        {expanded && live.body?.json && (
          <div
            className="border-border border-t pt-3 text-sm [&_*]:text-sm"
            {...inspectorProps({ fieldId: "body" })}
          >
            <CtfRichText json={live.body.json as Document} />
          </div>
        )}
      </div>
    </article>
  );
};
