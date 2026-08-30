import { CompatibleProtocolsCell } from "@/components/overview-table/macro-protocols-cell";
import { ResourceActivityCell } from "@/components/overview-table/resource-activity-cell";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getMacroLanguageBadgeTone, getMacroLanguageLabel } from "@/util/macro-language";
import Link from "next/link";

import type { Macro } from "@repo/api/domains/macro/macro.schema";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getMacroColumns(
  t: (key: string) => string,
  locale: string,
  pageIds: string[],
): OverviewTableColumn<Macro>[] {
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
      className: "w-32",
      cell: (macro) => (
        <StatusBadge tone={getMacroLanguageBadgeTone(macro.language)}>
          {getMacroLanguageLabel(macro.language)}
        </StatusBadge>
      ),
    },
    {
      header: t("macros.columns.protocols"),
      className: "hidden w-56 md:table-cell",
      cell: (macro) => <CompatibleProtocolsCell macroId={macro.id} />,
    },
    {
      header: t("macros.columns.activity"),
      className: "w-32",
      cell: (macro) => (
        <ResourceActivityCell kind="macro" resourceId={macro.id} pageIds={pageIds} />
      ),
    },
    {
      header: t("macros.columns.updated"),
      className: "w-40",
      cell: (macro) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(macro.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
