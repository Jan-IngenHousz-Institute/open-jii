"use client";

import type { OrganizationResourceTotals } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";

import { GROUP_ORDER, RESOURCE_TYPE_COLOR } from "./organization-resource-meta";

/**
 * What kind of work this organization does, as one bar. The header carries the total,
 * which is what let the resources stat tile go.
 *
 * Every owned type, in the same order and from the same numbers the resources card
 * below groups by, so every segment has a group beneath it and vice versa.
 *
 * Access-scoped: this is what *this caller* can see, deliberately not
 * `organization.resourceCount`. Renders nothing when there is nothing to proportion.
 */
export function OrganizationResourceMix({
  totals,
  isMember,
}: {
  totals: OrganizationResourceTotals;
  /** Labels the total; does not change what it counts. */
  isMember: boolean;
}) {
  const { t } = useTranslation();

  const segments = GROUP_ORDER.map((type) => ({ type, count: totals[type] })).filter(
    (segment) => segment.count > 0,
  );
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="organization-mix-title" className="text-lg font-semibold tracking-tight">
          {t("organizations.mix.title")}
        </h2>
        {/* See the same label on the directory card for why it is qualified. */}
        <span className="text-muted-foreground text-sm tabular-nums">
          {isMember
            ? t("organizations.resourceCount", { count: total })
            : t("organizations.visibleResourceCount", { count: total })}
        </span>
      </div>

      {/* Decorative: the legend below states every segment in words, so the bar is not
          announced as a row of unlabelled boxes. */}
      <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
        {segments.map((segment) => (
          <div
            key={segment.type}
            className={RESOURCE_TYPE_COLOR[segment.type]}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>

      <ul
        role="list"
        aria-labelledby="organization-mix-title"
        className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2"
      >
        {segments.map((segment) => (
          <li key={segment.type} className="flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${RESOURCE_TYPE_COLOR[segment.type]}`}
              aria-hidden
            />
            {t(`organizations.resources.types.${segment.type}`, { count: segment.count })}
            <span className="text-muted-foreground tabular-nums">{segment.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
