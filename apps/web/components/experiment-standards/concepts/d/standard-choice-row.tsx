"use client";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import { ChoiceToggle } from "./choice-toggle";
import { REQUIRED_STANDARD } from "./use-followed-standards";

export type ChoiceAvailability = "required" | "open" | "after-publishing" | "not-offered";

/** Whether a trial may choose a standard, and why not when it may not. */
export function availabilityOf({ standard, reason }: StandardReadiness): ChoiceAvailability {
  if (standard === REQUIRED_STANDARD) {
    return "required";
  }
  // FAIR scores a published dataset, so it cannot be something publishing waits for.
  if (standard === "fair") {
    return "after-publishing";
  }
  if (reason.code === "under-evaluation") {
    return "not-offered";
  }
  return "open";
}

interface StandardChoiceRowProps {
  readiness: StandardReadiness;
  isFollowing: boolean;
  onToggle: (standard: StandardId) => void;
}

/** One standard to follow or leave, in plain words, with where the trial stands on it. */
export function StandardChoiceRow({ readiness, isFollowing, onToggle }: StandardChoiceRowProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");
  const { standard, state, filled, total } = readiness;

  const availability = availabilityOf(readiness);
  const name = tStandards(`standard.${standard}.name`);
  const hasCount = state === "partial" && filled !== null && total !== null;

  const note = () => {
    if (availability === "required") {
      return t("follows.required");
    }
    if (state === "met") {
      return t("choose.alreadyMet");
    }
    if (hasCount) {
      return t("follows.progress", { filled, total });
    }
    return tStandards(`state.${state}`);
  };

  const isChoosable = availability === "open" || availability === "required";
  const detail = isChoosable ? t("follows.detail", { standard: name, progress: note() }) : name;

  const handleToggle = () => onToggle(standard);

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{tStandards(`destination.${standard}`)}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>

      <ChoiceToggle availability={availability} isFollowing={isFollowing} onToggle={handleToggle} />
    </li>
  );
}
