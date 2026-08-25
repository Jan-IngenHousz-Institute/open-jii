import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import Link from "next/link";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getExperimentColumns(
  t: (key: string) => string,
  locale: string,
): OverviewTableColumn<Experiment>[] {
  return [
    {
      header: t("columns.name"),
      cell: (experiment, href) => (
        <>
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
              overviewTableText.strong,
            )}
          >
            {experiment.name}
          </Link>
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={experiment.visibility} privateOnly className="ml-2" />
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer content={experiment.description ?? " "} truncate maxLines={2} />
          </div>
        </>
      ),
    },
    {
      header: t("columns.updated"),
      className: "w-40",
      cell: (experiment) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(experiment.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
