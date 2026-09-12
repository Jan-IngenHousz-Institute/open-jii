import { CompatibleProtocolsCell } from "@/components/overview-table/macro-protocols-cell";
import { ResourceMetricsCell } from "@/components/overview-table/resource-metrics-cell";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getMacroLanguageBadgeTone, getMacroLanguageLabel } from "@/util/macro-language";
import Link from "next/link";

import type { MacroListItem } from "@repo/api/domains/macro/macro.schema";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getMacroColumns(
  t: (key: string) => string,
  locale: string,
): OverviewTableColumn<MacroListItem>[] {
  return [
    {
      header: t("macros.columns.name"),
      cell: (macro, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              title={macro.name}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {macro.name}
            </Link>
            {macro.sortOrder !== null && (
              <Badge className="bg-secondary/30 text-primary shrink-0">
                {t("common.preferred")}
              </Badge>
            )}
            {/* Only when private: "public" is the unremarkable default. */}
            <VisibilityBadge visibility={macro.visibility} privateOnly className="shrink-0" />
          </div>
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer
              content={macro.description ?? " "}
              className="whitespace-normal break-words"
              truncate
              maxLines={2}
            />
          </div>
        </>
      ),
    },
    {
      header: t("macros.columns.language"),
      className: "hidden w-32 sm:table-cell",
      cell: (macro) => (
        <StatusBadge tone={getMacroLanguageBadgeTone(macro.language)}>
          {getMacroLanguageLabel(macro.language)}
        </StatusBadge>
      ),
    },
    {
      header: t("macros.columns.protocols"),
      className: "hidden w-56 xl:table-cell",
      cell: (macro) => <CompatibleProtocolsCell macroId={macro.id} />,
    },
    {
      header: t("macros.columns.activity"),
      // Gated like every other secondary column: table-fixed plus an ungated
      // 192px left the name ~90px at 390px.
      className: "hidden w-48 lg:table-cell",
      cell: (macro) => (
        <ResourceMetricsCell activity={macro.activity ?? null} windowDays={30} kind="macro" />
      ),
    },
    {
      header: t("macros.columns.updated"),
      className: "hidden w-40 lg:table-cell",
      cell: (macro) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(macro.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
