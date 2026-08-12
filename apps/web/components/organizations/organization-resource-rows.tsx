"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime, formatShortDate } from "@/util/date";
import { getExperimentStatusBadgeColor } from "@/util/experiment-status";
import { getMacroLanguageBadgeColor, getMacroLanguageLabel } from "@/util/macro-language";
import { getSensorFamilyBadgeColor, getSensorFamilyLabel } from "@/util/sensor-family";
import { stripHtml } from "@/util/strip-html";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { SearchInput } from "@repo/ui/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import type { ResourceSort, ResourceTypeFilter } from "./organization-resource-filter";
import {
  DEFAULT_RESOURCE_FILTER,
  filterAndSortResources,
  hasActiveFilters,
} from "./organization-resource-filter";
import { GROUP_ORDER, RESOURCE_SEGMENT, RESOURCE_TYPE_COLOR } from "./organization-resource-meta";

/** The sort options, in the order they are offered. */
const SORT_OPTIONS: readonly { value: ResourceSort; labelKey: string }[] = [
  { value: "recent", labelKey: "organizations.resources.sortRecent" },
  { value: "name", labelKey: "organizations.resources.sortName" },
  { value: "type", labelKey: "organizations.resources.sortType" },
];

/** A row's one type-specific fact, with the colour that fact already has. */
interface ResourceMeta {
  label: string;
  colorClass: string;
}

/**
 * The one extra fact worth putting on a row, different per type, each wearing the badge
 * that value already wears on its own listing. A status is a word so it is translated;
 * a sensor family, macro language and device class are product names, so they are not.
 */
function metaBadge(
  resource: OrganizationResource,
  t: (key: string) => string,
): ResourceMeta | null {
  switch (resource.type) {
    case "experiment":
      // All four statuses: "stale" and "published" say more than their absence would.
      return {
        label: t(`organizations.resources.status.${resource.status}`),
        colorClass: getExperimentStatusBadgeColor(resource.status),
      };
    case "protocol":
      return {
        label: getSensorFamilyLabel(resource.family),
        colorClass: getSensorFamilyBadgeColor(resource.family),
      };
    case "macro":
      return {
        label: getMacroLanguageLabel(resource.language),
        colorClass: getMacroLanguageBadgeColor(resource.language),
      };
    case "device":
      // `deviceType` is `zSensorFamily` under another name, so a MultispeQ device and a
      // MultispeQ protocol wear the identical badge.
      return {
        label: getSensorFamilyLabel(resource.deviceType),
        colorClass: getSensorFamilyBadgeColor(resource.deviceType),
      };
    case "workbook":
      return null;
  }
}

/**
 * Everything the organization owns that the caller can open, as one filtered list. Flat
 * rather than grouped: the sidebar's estate bar states the per-type counts the group
 * headers used to, and a flat list can answer "what was touched most recently here".
 *
 * The type options and the type sort both come off {@link GROUP_ORDER}, so neither can
 * drift from the featured card or the estate bar. `totals` is deliberately not a prop —
 * it existed for the group headers.
 */
export function OrganizationResourceRows({ resources }: { resources: OrganizationResource[] }) {
  const { t } = useTranslation();

  const [query, setQuery] = useState(DEFAULT_RESOURCE_FILTER.query);
  const [type, setType] = useState<ResourceTypeFilter>(DEFAULT_RESOURCE_FILTER.type);
  const [sort, setSort] = useState<ResourceSort>(DEFAULT_RESOURCE_FILTER.sort);

  // The read is uncapped, so without this it re-runs over everything on every keystroke.
  const visible = useMemo(
    () => filterAndSortResources(resources, { query, type, sort }),
    [resources, query, type, sort],
  );

  // Sort is not reset: it arranges rather than narrows.
  const clearFilters = () => {
    setQuery(DEFAULT_RESOURCE_FILTER.query);
    setType(DEFAULT_RESOURCE_FILTER.type);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("organizations.resources.searchPlaceholder")}
            aria-label={t("organizations.resources.searchLabel")}
            className="sm:flex-1"
          />

          <Select value={type} onValueChange={(next) => setType(next as ResourceTypeFilter)}>
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("organizations.resources.typeFilterLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("organizations.resources.allTypes")}</SelectItem>
              {/* Five options from the one shared order, not a hand-written list. */}
              {GROUP_ORDER.map((resourceType) => (
                <SelectItem key={resourceType} value={resourceType}>
                  {t(`organizations.resources.types.${resourceType}`, { count: 2 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(next) => setSort(next as ResourceSort)}>
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label={t("organizations.resources.sortLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <div className="border-border border-t py-10 text-center">
            <p className="text-foreground text-sm font-semibold">
              {t("organizations.resources.noMatchesTitle")}
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[320px] text-xs leading-relaxed">
              {t("organizations.resources.noMatchesHint")}
            </p>
            {/* Only when something is actually narrowing the list — a reset that resets
                nothing is a dead control. */}
            {hasActiveFilters({ query, type, sort }) ? (
              <Button variant="outline" size="sm" className="mt-3.5" onClick={clearFilters}>
                {t("organizations.resources.clearFilters")}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul role="list" className="border-border border-t">
            {visible.map((resource) => (
              <ResourceRow key={`${resource.type}-${resource.id}`} resource={resource} />
            ))}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
}

function ResourceRow({ resource }: { resource: OrganizationResource }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const meta = metaBadge(resource, t);

  return (
    <li className="border-border/60 border-b py-3 last:border-b-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <Link
          href={`/${locale}/platform/${RESOURCE_SEGMENT[resource.type]}/${resource.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {resource.name}
        </Link>
        {/* Only when private: public is the unremarkable default, so a badge for it
            would be noise on most rows. */}
        {resource.visibility === "private" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-muted-foreground shrink-0"
                aria-label={t("resourceVisibility.privateStatus")}
              >
                <Lock className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("organizations.resources.privateTooltip")}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>

      {/*
        Tags stripped, not rendered. A description is authored in a rich editor, so
        interpolating it raw prints literal `<p>` markup — and rendering it as real rich
        text would be wrong here anyway: bold, links and lists have no business in a
        one-line row. `RichTextRenderer` also ignores line clamping on plain-text
        content, so a plain description would blow the row height with no warning.

        Absent entirely for a device, which has no `description` column at all — the
        guard is what keeps that from reserving an empty line on every device row.
      */}
      {resource.description ? (
        <p className="text-muted-foreground mt-1 truncate text-xs">
          {stripHtml(resource.description)}
        </p>
      ) : null}

      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${RESOURCE_TYPE_COLOR[resource.type]}`}
            aria-hidden
          />
          {t(`organizations.resources.types.${resource.type}`, { count: 1 })}
        </span>

        {/* Default variant, colour class only: the pale `badge-*` fills are designed to
            sit under its `text-black`, which is how every other consumer pairs them.
            Absent for a workbook, which has no second fact worth a badge. */}
        {meta ? <Badge className={`shrink-0 ${meta.colorClass}`}>{meta.label}</Badge> : null}

        {/*
          Labelled, because a bare "2 days ago" does not say what happened then, and a
          row carries two plausible timestamps. Built as one string rather than two JSX
          expressions with a space between them: that space is whitespace between
          siblings, and it vanishes the moment the line is wrapped.

          A relative time is also lossy on its own — "2 days ago" is not something you
          can act on or cite — so the absolute date rides along as the title, and
          `dateTime` gives assistive tech and any scraper the unambiguous instant.
        */}
        <time
          dateTime={resource.updatedAt}
          title={`${t("common.updated")} ${formatShortDate(resource.updatedAt, locale)}`}
          className="shrink-0 sm:ml-auto"
        >
          {`${t("common.updated")} ${formatRelativeTime(resource.updatedAt, locale)}`}
        </time>
      </div>
    </li>
  );
}
