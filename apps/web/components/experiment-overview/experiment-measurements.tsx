"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useExperimentData } from "~/hooks/experiment/useExperimentData/useExperimentData";
import { useLocale } from "~/hooks/useLocale";
import { formatDate } from "~/util/date";

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

interface ExperimentMeasurementsProps {
  experimentId: string;
  isArchived?: boolean;
}

export function ExperimentMeasurements({
  experimentId,
  isArchived = false,
}: ExperimentMeasurementsProps) {
  const locale = useLocale();
  const { tableRows, isLoading, error } = useExperimentData(experimentId, 1, 4, "device");
  const { t } = useTranslation("experiments");
  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("measurements.latestMeasurements")}</CardTitle>
        <div className="animate-pulse space-y-2">
          <div className="h-[215px] rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error || !tableRows || tableRows.length === 0) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("measurements.latestMeasurements")}</CardTitle>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {t("measurements.noMeasurements")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>{t("measurements.latestMeasurements")}</CardTitle>
        <Link
          href={`/${locale}/platform/${isArchived ? "experiments-archive" : "experiments"}/${experimentId}/data`}
          className="shrink-0"
        >
          <Button variant="ghost" className="text-primary h-auto p-0 hover:bg-transparent">
            {t("measurements.seeAll")}
          </Button>
        </Link>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-surface-light">
              <TableRow>
                <TableHead className="px-6">{t("measurements.deviceId")}</TableHead>
                <TableHead className="px-6 text-right">{t("measurements.lastProcessed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row, index) => {
                const deviceId = row.device_id;
                const timestamp = row.processed_timestamp;

                return (
                  <TableRow key={index}>
                    <TableCell className="px-6 font-medium">
                      {deviceId != null &&
                      (typeof deviceId === "string" || typeof deviceId === "number")
                        ? String(deviceId)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground px-6 text-right">
                      {timestamp != null && typeof timestamp === "string"
                        ? formatDate(timestamp)
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
