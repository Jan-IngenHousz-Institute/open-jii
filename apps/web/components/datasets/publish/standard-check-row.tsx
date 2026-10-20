"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { AlertTriangle } from "lucide-react";

import type { StandardReadiness, StandardVerdict } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

const VERDICT_TONES: Record<StandardVerdict, StatusTone> = {
  met: "active",
  partial: "stale",
  notApplicable: "archived",
  notAssessed: "archived",
};

/** A standard that warns: it says what it lacks and never stops the freeze. */
export function StandardCheckRow({ readiness }: { readiness: StandardReadiness }) {
  const { t } = useTranslation("datasets");
  const { verdict, filled, total } = readiness;
  const isWarning = verdict === "partial";

  const verdictLabel =
    verdict === "partial" && filled !== null && total !== null
      ? t("check.verdicts.partialCount", { filled, total })
      : t(`check.verdicts.${verdict}`);

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(`check.standards.${readiness.standard}`)}</p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          {isWarning ? (
            <AlertTriangle className="text-status-stale-foreground size-3.5 shrink-0" aria-hidden />
          ) : null}
          {readiness.reason}
        </p>
      </div>
      <StatusBadge tone={VERDICT_TONES[verdict]} className="shrink-0">
        {verdictLabel}
      </StatusBadge>
    </li>
  );
}
