"use client";

import React from "react";

import { useCurrentLocale, useTranslation } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "../../lib/__generated/sdk";
import { ReleaseNoteEntry } from "./release-note-entry";

interface ReleaseNotesFeedProps {
  entries: ReleaseNoteFields[];
  /** Passed through to each entry; entries link to `${linkBaseHref}/${slug}` when both are present. */
  linkBaseHref?: string;
  /** Target for entry detail links (default same-tab). */
  linkTarget?: "_blank" | "_self";
  /** Visual treatment for the feed entries. `sheet` is used by the in-app What's new panel. */
  variant?: "default" | "sheet";
}

interface MonthGroup {
  key: string;
  label: string;
  entries: ReleaseNoteFields[];
}

/** Groups entries by month, preserving the incoming newest-first order. */
function groupByMonth(entries: ReleaseNoteFields[], locale: string): MonthGroup[] {
  const order: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();

  for (const entry of entries) {
    const date = entry.publishedAt ? new Date(entry.publishedAt as string) : null;
    const valid = date !== null && !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : "undated";

    let group = byKey.get(key);
    if (!group) {
      const label =
        valid && date
          ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date)
          : "";
      group = { key, label, entries: [] };
      byKey.set(key, group);
      order.push(group);
    }
    group.entries.push(entry);
  }

  return order;
}

/**
 * Renders release notes grouped by month (newest first). Shared between the web "What's new"
 * sheet and (later) the public openjii.org/releases page — entries come from Contentful via the
 * generated `activeReleaseNotes` query. Pure presentation; read-state lives in the consuming app.
 */
export const ReleaseNotesFeed: React.FC<ReleaseNotesFeedProps> = ({
  entries,
  linkBaseHref,
  linkTarget,
  variant = "default",
}) => {
  const { t } = useTranslation("navigation");
  const locale = useCurrentLocale(i18nConfig) ?? "en-US";

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("whatsNew.empty")}</p>;
  }

  const groups = groupByMonth(entries, locale);
  const isSheet = variant === "sheet";

  return (
    <div className={cn("flex flex-col", isSheet ? "gap-8" : "gap-10")}>
      {groups.map((group) => (
        <section key={group.key} className={cn("flex flex-col", isSheet ? "gap-5" : "gap-4")}>
          {group.label && (
            <h2
              className={cn(
                "text-muted-foreground uppercase",
                isSheet
                  ? "text-xs font-semibold tracking-wide"
                  : "font-mono text-xs font-medium tracking-[0.14em]",
              )}
            >
              {group.label}
            </h2>
          )}
          {isSheet ? (
            group.entries.map((entry) => (
              <ReleaseNoteEntry
                key={entry.sys.id}
                entry={entry}
                linkBaseHref={linkBaseHref}
                linkTarget={linkTarget}
                variant={variant}
              />
            ))
          ) : (
            // Timeline: no gap between nodes — each node's rail connector bridges the spacing.
            <div className="flex flex-col">
              {group.entries.map((entry, index) => (
                <ReleaseNoteEntry
                  key={entry.sys.id}
                  entry={entry}
                  linkBaseHref={linkBaseHref}
                  linkTarget={linkTarget}
                  variant={variant}
                  isLast={index === group.entries.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};
