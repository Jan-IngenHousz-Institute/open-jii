"use client";

import * as React from "react";

import type {
  ComponentReleaseNoteFieldsFragment as ReleaseNoteFields,
  ReleaseCategory,
} from "@repo/cms";
import { RELEASE_CATEGORIES, ReleaseHero, ReleaseNotesFeed } from "@repo/cms";
import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface ReleasesChangelogProps {
  /** All active release notes, newest first (from getAllReleaseNotes). */
  entries: ReleaseNoteFields[];
  /** Base path for detail links, e.g. `/en-US/releases`. */
  linkBaseHref: string;
}

type Filter = "all" | ReleaseCategory;

/**
 * Client shell for the public /releases changelog: spotlights the newest note as a
 * featured hero, then a category filter tab row, then the month-grouped timeline for the rest.
 * Filtering is purely client-side over the already-fetched entries. The hero stays pinned to the
 * top across every filter — today it's a fallback to the most recent note, but it's the seam where
 * a dedicated "feature banner" field will slot in once /releases gets its own content model. Only
 * categories actually present get a tab.
 */
export function ReleasesChangelog({ entries, linkBaseHref }: ReleasesChangelogProps) {
  const { t } = useTranslation("navigation");
  const [filter, setFilter] = React.useState<Filter>("all");

  if (entries.length === 0) {
    return <ReleaseNotesFeed entries={entries} linkBaseHref={linkBaseHref} linkTarget="_self" />;
  }

  const [featured, ...rest] = entries;
  const isAll = filter === "all";
  // The featured note is always the hero, so keep it out of the timeline regardless of filter.
  const feedEntries = isAll ? rest : rest.filter((entry) => entry.category === filter);
  // Chips come from `rest`, not all entries — otherwise a category whose only note is the pinned
  // featured hero would get a chip that filters to an empty timeline.
  const presentCategories = RELEASE_CATEGORIES.filter((category) =>
    rest.some((entry) => entry.category === category),
  );

  return (
    <div className="flex flex-col gap-10">
      <ReleaseHero entry={featured} linkBaseHref={linkBaseHref} linkTarget="_self" />

      {presentCategories.length > 0 && (
        <NavTabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <NavTabsList aria-label={t("releases.heading")}>
            <NavTabsTrigger value="all" count={rest.length}>
              {t("releases.filterAll")}
            </NavTabsTrigger>
            {presentCategories.map((category) => (
              <NavTabsTrigger
                key={category}
                value={category}
                count={rest.filter((entry) => entry.category === category).length}
              >
                {t(`whatsNew.category.${category}`)}
              </NavTabsTrigger>
            ))}
          </NavTabsList>
        </NavTabs>
      )}

      {feedEntries.length > 0 ? (
        <ReleaseNotesFeed entries={feedEntries} linkBaseHref={linkBaseHref} linkTarget="_self" />
      ) : (
        !isAll && <p className="text-muted-foreground text-sm">{t("whatsNew.empty")}</p>
      )}
    </div>
  );
}
