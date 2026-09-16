import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { getSensorFamilyBadgeTone } from "@/util/sensor-family";
import Link from "next/link";

import { cn } from "@repo/ui/lib/utils";

import type { CalibrationVersionLine } from "./calibration-version-lines";

export function getCalibrationDefinitionColumns(
  t: (key: string, values?: Record<string, unknown>) => string,
  locale: string,
): OverviewTableColumn<CalibrationVersionLine>[] {
  return [
    {
      header: t("iot.calibration.library.columns.name"),
      cell: (line, href) => (
        <div className="min-w-0 space-y-0.5">
          <Link
            href={href}
            title={line.name}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden block min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
              overviewTableText.strong,
            )}
          >
            {line.name}
          </Link>
          {line.latest.description !== null && (
            <p className={cn("truncate text-xs", overviewTableText.muted)}>
              {line.latest.description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: t("iot.calibration.library.columns.family"),
      className: "w-[130px]",
      cell: (line) => (
        <StatusBadge tone={getSensorFamilyBadgeTone(line.latest.family)} className="capitalize">
          {line.latest.family}
        </StatusBadge>
      ),
    },
    {
      header: t("iot.calibration.library.columns.version"),
      className: "w-[120px]",
      cell: (line) => (
        <span className={cn("text-xs", overviewTableText.muted)}>
          {t("iot.calibration.library.versionOf", {
            version: line.latest.version,
            count: line.versions.length,
          })}
        </span>
      ),
    },
    {
      header: t("iot.calibration.library.columns.visibility"),
      className: "w-[120px]",
      cell: (line) => <VisibilityBadge visibility={line.latest.visibility} />,
    },
    {
      header: t("iot.calibration.library.columns.updated"),
      className: "w-[130px]",
      cell: (line) => (
        <span className={cn("text-xs", overviewTableText.muted)}>
          {formatShortDate(line.latest.updatedAt, locale)}
        </span>
      ),
    },
  ];
}
