import { ResourceMetricsCell } from "@/components/overview-table/resource-metrics-cell";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { Users } from "lucide-react";
import Link from "next/link";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import type { Experiment, ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

const STATUS_DOT: Record<ExperimentStatus, string> = {
  active: "bg-status-active-foreground",
  published: "bg-status-published-foreground",
  stale: "bg-status-stale-foreground",
  archived: "bg-status-archived-foreground",
};

function ownerName(experiment: Experiment): string | null {
  const name = [experiment.ownerFirstName, experiment.ownerLastName].filter(Boolean).join(" ");
  return name || null;
}

function ownerInitials(experiment: Experiment): string {
  return (
    `${experiment.ownerFirstName?.[0] ?? ""}${experiment.ownerLastName?.[0] ?? ""}`.toUpperCase() ||
    "?"
  );
}

export function getExperimentColumns(
  t: (key: string) => string,
  locale: string,
): OverviewTableColumn<ExperimentListItem>[] {
  return [
    {
      header: t("columns.name"),
      cell: (experiment, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              title={experiment.name}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {experiment.name}
            </Link>
            {/* Only when private: "public" is the unremarkable default. */}
            <VisibilityBadge visibility={experiment.visibility} privateOnly className="shrink-0" />
          </div>
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer
              content={experiment.description ?? " "}
              className="whitespace-normal break-words"
              truncate
              maxLines={2}
            />
          </div>
        </>
      ),
    },
    {
      header: t("columns.status"),
      className: "hidden w-28 sm:table-cell",
      cell: (experiment) => {
        const label = t(`status.${experiment.status}`);
        return (
          <span
            title={label}
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 text-[13px]",
              overviewTableText.muted,
            )}
          >
            <span
              className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[experiment.status])}
              aria-hidden
            />
            <span className="truncate">{label}</span>
          </span>
        );
      },
    },
    {
      header: t("columns.owner"),
      className: "hidden w-48 lg:table-cell",
      cell: (experiment) => {
        const name = ownerName(experiment);
        return name ? (
          <span className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className={cn("text-[10px] font-medium", overviewTableText.muted)}>
                {ownerInitials(experiment)}
              </AvatarFallback>
            </Avatar>
            <span
              title={name}
              className={cn("min-w-0 truncate text-[13px]", overviewTableText.muted)}
            >
              {name}
            </span>
          </span>
        ) : (
          <span className={cn("text-[13px]", overviewTableText.muted)}>{"\u2014"}</span>
        );
      },
    },
    {
      header: t("columns.organization"),
      className: "hidden w-44 xl:table-cell",
      cell: (experiment) => (
        <span
          title={experiment.organizationName ?? undefined}
          className={cn("block truncate text-[13px]", overviewTableText.muted)}
        >
          {experiment.organizationName ?? "\u2014"}
        </span>
      ),
    },
    {
      header: t("columns.members"),
      className: "hidden w-24 lg:table-cell",
      cell: (experiment) =>
        experiment.membersCount != null && experiment.membersCount > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[13px] tabular-nums",
              overviewTableText.muted,
            )}
          >
            <Users className="size-3.5" aria-hidden />
            {experiment.membersCount}
          </span>
        ) : (
          <span className={cn("text-[13px]", overviewTableText.muted)}>{"\u2014"}</span>
        ),
    },
    {
      header: t("columns.activity"),
      className: "w-48",
      cell: (experiment) => (
        <ResourceMetricsCell activity={experiment.activity ?? null} windowDays={30} />
      ),
    },
    {
      header: t("columns.updated"),
      className: "w-32",
      cell: (experiment) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(experiment.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
