"use client";

import { Lock } from "lucide-react";

import { ALWAYS_FOLLOWED } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import { StandardName } from "./standard-name";

interface FollowedStandardCardProps {
  readiness: StandardReadiness;
  /** The steps left that hold Freeze and move this standard. */
  stepsLeft: number;
  onOpen: (standard: StandardId) => void;
}

/** A followed standard in plain words, how far the experiment is, and its steps left. Opens its fields. */
export function FollowedStandardCard({ readiness, stepsLeft, onOpen }: FollowedStandardCardProps) {
  const { t } = useTranslation("standards");
  const { standard, filled, total, status } = readiness;

  const isAlwaysFollowed = standard === ALWAYS_FOLLOWED;
  const hasCount = filled !== null && total !== null && total > 0;
  const percent = hasCount ? (filled / total) * 100 : 0;

  const handleClick = () => onOpen(standard);

  const footer = () => {
    if (isAlwaysFollowed) {
      return (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock aria-hidden className="size-3 shrink-0" />
          {t("follows.always")}
        </p>
      );
    }
    if (stepsLeft > 0) {
      return (
        <p className="text-status-stale-foreground text-xs font-medium">
          {t("follows.stepsLeft", { count: stepsLeft })}
        </p>
      );
    }
    return <p className="text-muted-foreground text-xs">{t("follows.noStepsLeft")}</p>;
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="hover:bg-muted/50 bg-card flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
      >
        <StandardName standard={standard} detail={t(`status.${status.code}`, { ...status })} />
        {hasCount ? <Progress value={percent} className="h-1.5" /> : null}
        {footer()}
      </button>
    </li>
  );
}
