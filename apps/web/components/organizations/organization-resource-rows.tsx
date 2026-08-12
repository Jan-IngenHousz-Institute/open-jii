"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime, formatShortDate } from "@/util/date";
import { getExperimentStatusBadgeColor } from "@/util/experiment-status";
import { getMacroLanguageBadgeColor, getMacroLanguageLabel } from "@/util/macro-language";
import { getSensorFamilyBadgeColor, getSensorFamilyLabel } from "@/util/sensor-family";
import { stripHtml } from "@/util/strip-html";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  OrganizationResource,
  OrganizationResourceTotals,
  OrganizationResourceType,
} from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

/** Where each showcased resource type lives on the platform. */
const RESOURCE_SEGMENT: Record<OrganizationResourceType, string> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
};

/** The order the groups read in: the two things you make, then the two you write. */
const GROUP_ORDER: readonly OrganizationResourceType[] = [
  "experiment",
  "protocol",
  "macro",
  "workbook",
];

/** Rows a group shows before it has to be asked to expand. */
const PREVIEW_ROW_COUNT = 3;

/** A row's one type-specific fact, with the colour that fact already has. */
interface ResourceMeta {
  label: string;
  colorClass: string;
}

/**
 * The one extra fact worth putting on a row, which is a different fact per type — and
 * in each case a fact the platform already has a colour for, so the badge is the same
 * badge these values wear on the experiments, protocols and macros listings rather
 * than a plain outline unique to this surface.
 *
 * An experiment's lifecycle status is a word, so it is translated; a sensor family and
 * a macro language are product names, so they are not. A workbook has none — its row
 * is its title and its description.
 */
function metaBadge(
  resource: OrganizationResource,
  t: (key: string) => string,
): ResourceMeta | null {
  switch (resource.type) {
    case "experiment":
      // All four statuses, not just the alarming ones: "stale" and "published" say
      // more about an experiment than their absence would.
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
    case "workbook":
      return null;
  }
}

/**
 * The showcase, grouped by type. Grouping rather than one merged list because the
 * per-group count is the fact a visitor is actually after — how much of each kind of
 * work this organization does — and a recency-sorted mix cannot state it.
 *
 * Within a group the rows stay in the recency order the server sorted them into.
 */
export function OrganizationResourceRows({
  resources,
  totals,
}: {
  resources: OrganizationResource[];
  totals: OrganizationResourceTotals;
}) {
  const groups = GROUP_ORDER.map((type) => ({
    type,
    total: totals[type],
    items: resources.filter((resource) => resource.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          // Keyed by type, so expanding a group survives the query refetching under it.
          <ResourceGroup
            key={group.type}
            type={group.type}
            total={group.total}
            items={group.items}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

/**
 * One type's rows: a three-row preview that expands in place.
 *
 * Expanding shows every row there is. The read is uncapped, so `total` and the rows
 * agree by construction and "View all (40)" opens onto forty — there is no shortfall
 * left for this component to have to disclose.
 */
function ResourceGroup({
  type,
  total,
  items,
}: {
  type: OrganizationResourceType;
  total: number;
  items: OrganizationResource[];
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const groupLabel = t(`organizations.resources.types.${type}`, { count: total });
  const preview = items.slice(0, PREVIEW_ROW_COUNT);
  const rest = items.slice(PREVIEW_ROW_COUNT);

  return (
    <section>
      <div className="mb-1 flex items-center gap-3">
        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
          {groupLabel}
        </h3>
        <span className="text-muted-foreground/70 text-[11px] font-semibold tabular-nums">
          {total}
        </span>
        <span className="bg-border h-px flex-1" aria-hidden />
      </div>

      <ul role="list">
        {preview.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} />
        ))}
      </ul>

      {rest.length > 0 ? (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            <ul role="list">
              {rest.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </ul>
          </CollapsibleContent>

          {/*
            The count is what clicking gains you, not the group's size — the header
            already states that a few pixels above, and with four rows you are looking
            at three while "View all (4)" would offer one more than it reveals.

            `rest.length` rather than a subtraction from `total`: `rest` *is* the hidden
            set, so the number cannot drift from the rows the control opens onto.

            Radix supplies aria-expanded and aria-controls; the accessible name adds
            which group, since "Show 3 more" alone does not say of what.
          */}
          <CollapsibleTrigger
            className="text-primary mt-2 flex items-center gap-1 text-xs hover:underline"
            aria-label={
              isOpen
                ? t("organizations.resources.showLessLabel", { group: groupLabel })
                : t("organizations.resources.showMoreLabel", {
                    group: groupLabel,
                    count: rest.length,
                  })
            }
          >
            {isOpen ? (
              <ChevronUp className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            )}
            {isOpen
              ? t("organizations.resources.showLess")
              : t("organizations.resources.showMore", { count: rest.length })}
          </CollapsibleTrigger>
        </Collapsible>
      ) : null}
    </section>
  );
}

function ResourceRow({ resource }: { resource: OrganizationResource }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const meta = metaBadge(resource, t);

  return (
    <li className="border-border/60 flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
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
          Tags stripped, not rendered. An experiment's description is authored in a rich
          editor, so interpolating it raw prints literal `<p>` markup — and rendering it
          as real rich text would be wrong here anyway: bold, links and lists have no
          business in a one-line row.

          `stripHtml` plus a CSS clamp also behaves identically whatever the content is.
          `RichTextRenderer` silently ignores `truncate` on non-HTML content, so a
          plain-text description would blow the row height with no warning.
        */}
        {resource.description ? (
          <p className="text-muted-foreground truncate text-xs">
            {stripHtml(resource.description)}
          </p>
        ) : null}
      </div>

      {/* Default variant, colour class only: the pale `badge-*` fills are designed to
          sit under its `text-black`, which is how every other consumer pairs them. */}
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
        className="text-muted-foreground shrink-0 text-xs"
      >
        {`${t("common.updated")} ${formatRelativeTime(resource.updatedAt, locale)}`}
      </time>
    </li>
  );
}
