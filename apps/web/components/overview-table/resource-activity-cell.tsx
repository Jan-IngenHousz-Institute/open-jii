"use client";

import { ActivityStrip } from "@/components/metrics/activity-strip";
import { useResourceActivity } from "@/hooks/metrics/useResourceActivity/useResourceActivity";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface ResourceActivityCellProps {
  kind: ResourceKind;
  resourceId: string;
}

/**
 * A row's measurement activity. One query serves every row on the page: React
 * Query dedupes by key, so the table reads a single response rather than
 * fanning out per row.
 */
export function ResourceActivityCell({ kind, resourceId }: ResourceActivityCellProps) {
  const { t } = useTranslation("publicMetrics");
  const { data } = useResourceActivity(kind);

  const resource = data?.resources.find((entry) => entry.id === resourceId);
  if (resource === undefined) {
    return null;
  }

  return (
    <ActivityStrip
      days={resource.days}
      label={t("resourceActivity.strip", { days: data?.windowDays ?? 0 })}
    />
  );
}
