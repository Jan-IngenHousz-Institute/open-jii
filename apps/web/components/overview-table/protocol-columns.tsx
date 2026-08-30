import { CompatibleMacrosCell } from "@/components/overview-table/protocol-macros-cell";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getSensorFamilyBadgeTone } from "@/util/sensor-family";
import Link from "next/link";

import type { ProtocolListItem } from "@repo/api/domains/protocol/protocol.schema";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getProtocolColumns(
  t: (key: string) => string,
  locale: string,
): OverviewTableColumn<ProtocolListItem>[] {
  return [
    {
      header: t("protocols.columns.name"),
      cell: (protocol, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              title={protocol.name}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {protocol.name}
            </Link>
            {protocol.sortOrder !== null && (
              <Badge className="bg-secondary/30 text-primary shrink-0">
                {t("common.preferred")}
              </Badge>
            )}
            {/* Only when private: "public" is the unremarkable default. */}
            <VisibilityBadge visibility={protocol.visibility} privateOnly className="shrink-0" />
          </div>
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer
              content={protocol.description ?? " "}
              className="whitespace-normal break-words"
              truncate
              maxLines={2}
            />
          </div>
        </>
      ),
    },
    {
      header: t("protocols.columns.family"),
      className: "w-36",
      cell: (protocol) => (
        <StatusBadge tone={getSensorFamilyBadgeTone(protocol.family)} className="capitalize">
          {protocol.family}
        </StatusBadge>
      ),
    },
    {
      header: t("protocols.columns.macros"),
      className: "hidden w-56 md:table-cell",
      cell: (protocol) => <CompatibleMacrosCell protocolId={protocol.id} />,
    },
    {
      header: t("protocols.columns.updated"),
      className: "w-40",
      cell: (protocol) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(protocol.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
