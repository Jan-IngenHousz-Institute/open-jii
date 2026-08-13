"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

interface DataByExperimentProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
}

interface ExperimentRow {
  id: string;
  name: string;
  count: number;
  lastBucketAt: string | null;
  bound: boolean;
}

/**
 * The device's data at the per-experiment grain: counts and recency here, the
 * actual measurement values one link away in each experiment's Data tab. A
 * bound experiment with no data in range is flagged, not hidden.
 */
export function DataByExperiment({ monitoring, boundExperiments }: DataByExperimentProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const totals = new Map<string, { count: number; lastBucketAt: string | null }>();
  for (const bucket of monitoring.throughput) {
    if (bucket.experimentId === null) {
      continue;
    }
    const entry = totals.get(bucket.experimentId) ?? { count: 0, lastBucketAt: null };
    entry.count += bucket.count;
    if (entry.lastBucketAt === null || bucket.bucketStart > entry.lastBucketAt) {
      entry.lastBucketAt = bucket.bucketStart;
    }
    totals.set(bucket.experimentId, entry);
  }

  const rows: ExperimentRow[] = boundExperiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.name,
    count: totals.get(experiment.id)?.count ?? 0,
    lastBucketAt: totals.get(experiment.id)?.lastBucketAt ?? null,
    bound: true,
  }));

  // Data arriving for experiments the device is no longer bound to still shows:
  // hiding it would hide a misconfiguration.
  for (const [experimentId, entry] of totals) {
    if (!boundExperiments.some((experiment) => experiment.id === experimentId)) {
      rows.push({
        id: experimentId,
        name: experimentId,
        count: entry.count,
        lastBucketAt: entry.lastBucketAt,
        bound: false,
      });
    }
  }

  const grandTotal = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noExperiments")}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <Link
              href={`/${locale}/platform/experiments/${row.id}/data`}
              className="font-medium hover:underline"
            >
              {row.name}
            </Link>
            {row.count === 0 && row.bound && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {t("iot.devices.monitoring.boundButSilent")}
              </span>
            )}
            {!row.bound && (
              <span className="text-muted-foreground ml-2 text-xs">
                {t("iot.devices.monitoring.notBound")}
              </span>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {row.lastBucketAt === null
              ? t("iot.devices.monitoring.noData")
              : formatRelativeTime(row.lastBucketAt, locale)}
          </span>
          <span className="w-20 text-right text-sm tabular-nums">{row.count}</span>
          <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-[#1f77b4]"
              style={{
                width: `${String(grandTotal === 0 ? 0 : (row.count / grandTotal) * 100)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
