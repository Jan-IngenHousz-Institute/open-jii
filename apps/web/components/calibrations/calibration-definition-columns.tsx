import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getSensorFamilyBadgeTone, getSensorFamilyLabel } from "@/util/sensor-family";
import Link from "next/link";

import type { CalibrationDefinitionSummary } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { cn } from "@repo/ui/lib/utils";

export function getCalibrationDefinitionColumns(
  t: (key: string, values?: Record<string, unknown>) => string,
  locale: string,
): OverviewTableColumn<CalibrationDefinitionSummary>[] {
  return [
    {
      header: t("iot.calibration.library.columns.name"),
      cell: (definition, href) => (
        <div className="min-w-0 space-y-0.5">
          <Link
            href={href}
            title={definition.name}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden block min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
              overviewTableText.strong,
            )}
          >
            {definition.name}
          </Link>
          {definition.description !== null && (
            <p className={cn("truncate text-xs", overviewTableText.muted)}>
              {definition.description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: t("iot.calibration.library.columns.family"),
      className: "w-[130px]",
      cell: (definition) => (
        <StatusBadge tone={getSensorFamilyBadgeTone(definition.family)}>
          {getSensorFamilyLabel(definition.family)}
        </StatusBadge>
      ),
    },
    {
      header: t("iot.calibration.library.columns.visibility"),
      className: "w-[120px]",
      cell: (definition) => <VisibilityBadge visibility={definition.visibility} />,
    },
    {
      header: t("iot.calibration.library.columns.updated"),
      className: "w-[130px]",
      cell: (definition) => (
        <span className={cn("text-xs", overviewTableText.muted)}>
          {formatShortDate(definition.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
