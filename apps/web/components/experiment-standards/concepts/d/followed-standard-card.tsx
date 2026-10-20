"use client";

import { Check, Lock } from "lucide-react";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import { REQUIRED_STANDARD } from "./use-followed-standards";

interface FollowedStandardCardProps {
  readiness: StandardReadiness;
  onOpen: (standard: StandardId) => void;
}

/** A standard the trial follows, in plain words, and how far the trial is. Opens its fields. */
export function FollowedStandardCard({ readiness, onOpen }: FollowedStandardCardProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");
  const { standard, state, filled, total } = readiness;

  const isRequired = standard === REQUIRED_STANDARD;
  const hasCount = state === "partial" && filled !== null && total !== null && total > 0;
  const progress = hasCount
    ? t("follows.progress", { filled, total })
    : tStandards(`state.${state}`);
  const percent = hasCount ? (filled / total) * 100 : 0;

  const handleClick = () => onOpen(standard);

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="hover:bg-muted/50 border-primary/40 bg-card flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
      >
        <div className="space-y-0.5">
          <p className="flex items-start gap-1.5 text-sm font-medium">
            <Check aria-hidden className="text-primary mt-0.5 size-3.5 shrink-0" />
            {tStandards(`destination.${standard}`)}
          </p>
          <p className="text-muted-foreground text-xs">
            {t("follows.detail", { standard: tStandards(`standard.${standard}.name`), progress })}
          </p>
        </div>

        {hasCount ? <Progress value={percent} className="h-1.5" /> : null}

        {isRequired ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Lock aria-hidden className="size-3 shrink-0" />
            {t("follows.required")}
          </p>
        ) : null}
      </button>
    </li>
  );
}
