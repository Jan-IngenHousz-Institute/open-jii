import { ExperimentStatusIndicator } from "@/components/experiment/experiment-status-indicator";
import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { ResourceMetricsCell } from "@/components/overview-table/resource-metrics-cell";
import { ownName, personName } from "@/components/people/person-name";
import { LocalTime } from "@/components/shared/local-time";
import { UserAvatar } from "@/components/user-avatar";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { Users } from "lucide-react";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getExperimentColumns(
  t: (key: string) => string,
  locale: string,
): OverviewTableColumn<ExperimentListItem>[] {
  return [
    {
      header: t("columns.name"),
      sortId: "name",
      cell: (experiment, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <IntentLink
              href={href}
              title={experiment.name}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {experiment.name}
            </IntentLink>
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
      sortId: "status",
      className: "hidden w-28 sm:table-cell",
      cell: (experiment) => (
        <ExperimentStatusIndicator
          status={experiment.status}
          className={cn("text-[13px]", overviewTableText.muted)}
        />
      ),
    },
    {
      header: t("columns.owner"),
      sortId: "owner",
      className: "hidden w-48 lg:table-cell",
      cell: (experiment) => {
        const owner = {
          firstName: experiment.ownerFirstName,
          lastName: experiment.ownerLastName,
        };
        const name = personName(owner, t);
        return (
          <span className="flex items-center gap-2">
            <UserAvatar name={ownName(owner) ?? ""} className="size-6 text-[10px]" />
            <span
              title={name}
              className={cn("min-w-0 truncate text-[13px]", overviewTableText.muted)}
            >
              {name}
            </span>
          </span>
        );
      },
    },
    {
      header: t("columns.organization"),
      sortId: "organization",
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
      sortId: "members",
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
      // Gated like the other secondary columns: ungated, it left the name ~90px.
      className: "hidden w-48 lg:table-cell",
      cell: (experiment) => (
        <ResourceMetricsCell
          activity={experiment.activity ?? null}
          windowDays={30}
          kind="experiment"
        />
      ),
    },
    {
      header: t("columns.updated"),
      sortId: "updated",
      className: "hidden w-32 lg:table-cell",
      cell: (experiment) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          <LocalTime value={experiment.updatedAt} locale={locale} />
        </span>
      ),
    },
  ];
}
