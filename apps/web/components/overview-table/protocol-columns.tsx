import { CompatibleMacrosCell } from "@/components/overview-table/protocol-macros-cell";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getSensorFamilyBadgeColor } from "@/util/sensor-family";
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
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
              overviewTableText.strong,
            )}
          >
            {protocol.name}
          </Link>
          {protocol.sortOrder !== null && (
            <Badge className="bg-secondary/30 text-primary ml-2">{t("common.preferred")}</Badge>
          )}
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={protocol.visibility} privateOnly className="ml-2" />
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer content={protocol.description ?? " "} truncate maxLines={2} />
          </div>
        </>
      ),
    },
    {
      header: t("protocols.columns.family"),
      className: "w-36",
      cell: (protocol) => (
        <Badge className={cn(getSensorFamilyBadgeColor(protocol.family), "capitalize")}>
          {protocol.family}
        </Badge>
      ),
    },
    {
      header: t("protocols.columns.macros"),
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
