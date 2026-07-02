"use client";

import * as React from "react";

import type {
  ComponentReleaseNoteFieldsFragment as ReleaseNoteFields,
  ReleaseCategory,
} from "@repo/cms";
import { RELEASE_CATEGORIES, ReleaseFeature, ReleaseNotesFeed } from "@repo/cms";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface ReleasesChangelogProps {
  /** All active release notes, newest first (from getAllReleaseNotes). */
  entries: ReleaseNoteFields[];
  /** Base path for detail links, e.g. `/en-US/releases`. */
  linkBaseHref: string;
}

type Filter = "all" | ReleaseCategory;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 bg-white",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Client shell for the public /releases changelog: spotlights the newest note as a
 * featured hero, then a category filter row, then the month-grouped timeline for the rest. Filtering
 * is purely client-side over the already-fetched entries. The hero stays pinned to the top across
 * every filter — today it's a fallback to the most recent note, but it's the seam where a dedicated
 * "feature banner" field will slot in once /releases gets its own content model. Only categories
 * actually present get a chip.
 */
export function ReleasesChangelog({ entries, linkBaseHref }: ReleasesChangelogProps) {
  const { t } = useTranslation("navigation");
  const [filter, setFilter] = React.useState<Filter>("all");

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("whatsNew.empty")}</p>;
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
      <ReleaseFeature entry={featured} linkBaseHref={linkBaseHref} />

      {presentCategories.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("releases.heading")}>
          <FilterChip active={isAll} onClick={() => setFilter("all")}>
            {t("releases.filterAll")}
          </FilterChip>
          {presentCategories.map((category) => (
            <FilterChip
              key={category}
              active={filter === category}
              onClick={() => setFilter(category)}
            >
              {t(`whatsNew.category.${category}`)}
            </FilterChip>
          ))}
        </div>
      )}

      {feedEntries.length > 0 ? (
        <ReleaseNotesFeed entries={feedEntries} linkBaseHref={linkBaseHref} linkTarget="_self" />
      ) : (
        !isAll && <p className="text-muted-foreground text-sm">{t("whatsNew.empty")}</p>
      )}
    </div>
  );
}
