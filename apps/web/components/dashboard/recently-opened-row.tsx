"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import {
  RESOURCE_SEGMENT,
  RESOURCE_TYPE_COLOR,
  resourceMetaBadge,
} from "@/components/organizations/organization-resource-meta";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import type { RecentlyOpenedResource } from "@repo/api/domains/visit/visit.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

/** A row's resource without its visit, so a related experiment never opened fits too. */
export type RecentlyOpenedRowResource = RecentlyOpenedResource extends infer Row
  ? Row extends RecentlyOpenedResource
    ? Omit<Row, "openedAt">
    : never
  : never;

interface RecentlyOpenedRowProps {
  resource: RecentlyOpenedRowResource;
  at: string;
  /** Whether `at` is when the reader opened it or when it was last updated. */
  kind: "opened" | "updated";
}

export function RecentlyOpenedRow({ resource, at, kind }: RecentlyOpenedRowProps) {
  const { t } = useTranslation();
  const { t: tExperiments } = useTranslation("experiments");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const meta = resourceMetaBadge(resource, t);
  // The fact beside the badge: an experiment's organization or a workbook's version.
  const versionLabel =
    resource.type === "workbook" && resource.latestVersion !== null
      ? t("dashboard.workbookVersion", { version: resource.latestVersion })
      : null;
  const detail = resource.type === "experiment" ? resource.organizationName : versionLabel;
  const timeLabel =
    kind === "opened"
      ? tExperiments("openedOn", { when: format.relative(at) })
      : tExperiments("updatedOn", { date: format.date(at) });

  return (
    <li className="border-border/60 @container border-b py-3 last:border-b-0">
      <div className="@md:flex-row @md:items-center @md:justify-between flex flex-col gap-1.5">
        <div className="min-w-0">
          <IntentLink
            href={`/${locale}/platform/${RESOURCE_SEGMENT[resource.type]}/${resource.id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {resource.name}
          </IntentLink>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={cn("size-2 shrink-0 rounded-full", RESOURCE_TYPE_COLOR[resource.type])}
                aria-hidden
              />
              {t(`organizations.resources.types.${resource.type}`, { count: 1 })}
            </span>
            {meta ? (
              <StatusBadge tone={meta.tone} className="shrink-0 rounded px-1.5 py-0">
                {meta.label}
              </StatusBadge>
            ) : null}
            {detail ? <span className="min-w-0 truncate">{detail}</span> : null}
          </div>
        </div>

        <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
          {resource.callerRole ? (
            <Badge variant="outline" className="font-normal">
              {tExperiments(`callerRoles.${resource.callerRole}`)}
            </Badge>
          ) : null}
          <time dateTime={at} title={format.dateTime(at)} className="tabular-nums">
            {timeLabel}
          </time>
        </div>
      </div>
    </li>
  );
}
