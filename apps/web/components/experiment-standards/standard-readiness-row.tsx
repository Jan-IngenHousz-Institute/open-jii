"use client";

import type { StatusTone } from "@/components/shared/status-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChevronRight } from "lucide-react";

import type {
  ReadinessState,
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

const STATE_TONES: Record<ReadinessState, StatusTone> = {
  "not-assessed": "archived",
  "not-applicable": "archived",
  partial: "stale",
  met: "active",
};

interface StandardReadinessRowProps {
  readiness: StandardReadiness;
  onOpen: (standard: StandardId) => void;
}

/** One standard on the readiness screen: what it is for, where the experiment stands and why. */
export function StandardReadinessRow({ readiness, onOpen }: StandardReadinessRowProps) {
  const { t } = useTranslation("standards");
  const { standard, state, filled, total, reason } = readiness;

  const hasCount = state === "partial" && filled !== null && total !== null;
  const stateLabel = hasCount
    ? t("state.partialCount", { filled, total })
    : t(`state.${state}`);

  const handleClick = () => onOpen(standard);

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={handleClick}
        className="hover:bg-muted/50 flex w-full items-start gap-4 px-4 py-3 text-left transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">{t(`standard.${standard}.name`)}</p>
          <p className="text-muted-foreground text-xs">{t(`standard.${standard}.purpose`)}</p>
          <p className="pt-1 text-sm">{t(`reason.${reason.code}`, { ...reason })}</p>
        </div>

        <StatusBadge tone={STATE_TONES[state]} className="shrink-0">
          {stateLabel}
        </StatusBadge>
        <ChevronRight aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      </button>
    </li>
  );
}
