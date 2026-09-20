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
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              title={definition.name}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {definition.name}
            </Link>
            {/* The family column is gone on a phone; the badge rides with the name there. */}
            <StatusBadge
              tone={getSensorFamilyBadgeTone(definition.family)}
              className="shrink-0 sm:hidden"
            >
              {getSensorFamilyLabel(definition.family)}
            </StatusBadge>
            {/* Only when private: "public" is the unremarkable default. */}
            <VisibilityBadge visibility={definition.visibility} privateOnly className="shrink-0" />
          </div>
          {definition.description !== null && (
            <p className={cn("mt-0.5 truncate text-[13px]", overviewTableText.muted)}>
              {definition.description}
            </p>
          )}
        </>
      ),
    },
    {
      header: t("iot.calibration.library.columns.family"),
      className: "hidden w-36 sm:table-cell",
      cell: (definition) => (
        <StatusBadge tone={getSensorFamilyBadgeTone(definition.family)}>
          {getSensorFamilyLabel(definition.family)}
        </StatusBadge>
      ),
    },
    {
      header: t("iot.calibration.library.columns.visibility"),
      className: "hidden w-40 lg:table-cell",
      cell: (definition) => <VisibilityBadge visibility={definition.visibility} />,
    },
    {
      header: t("iot.calibration.library.columns.updated"),
      className: "hidden w-40 lg:table-cell",
      cell: (definition) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(definition.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
