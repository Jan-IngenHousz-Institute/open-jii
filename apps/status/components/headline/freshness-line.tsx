"use client";

import { TriangleAlert } from "lucide-react";
import { useFormat } from "~/hooks/use-format";

import { useTranslation } from "@repo/i18n/client";

interface FreshnessLineProps {
  generatedAt: string;
  now: number;
  isStale: boolean;
  hasRefreshFailed: boolean;
}

export function FreshnessLine({ generatedAt, now, isStale, hasRefreshFailed }: FreshnessLineProps) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const text = {
    time: format.time(generatedAt),
    ago: format.ago(now - Date.parse(generatedAt)),
  };
  const warning = hasRefreshFailed ? "freshness.refreshFailed" : "freshness.delayed";

  if (hasRefreshFailed || isStale) {
    return (
      <p className="text-status-stale-foreground flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />
        {t(warning, text)}
      </p>
    );
  }

  return <p className="text-muted-foreground">{t("freshness.lastChecked", text)}</p>;
}
