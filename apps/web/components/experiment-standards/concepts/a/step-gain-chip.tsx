"use client";

import { ChevronRight } from "lucide-react";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { badgeVariants } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

import type { StandardGain } from "./step-gains";

interface StepGainChipProps {
  gain: StandardGain;
  onOpen: (standard: StandardId) => void;
}

/** Where a step moves the trial, in plain words, opening that standard's fields. */
export function StepGainChip({ gain, onOpen }: StepGainChipProps) {
  const { t } = useTranslation("readinessConceptA");
  const { t: tStandards } = useTranslation("standards");

  const destination = tStandards(`destination.${gain.standard}`);
  const hasFields = gain.fields > 0;
  const label = hasFields
    ? t("chip", { destination, fields: tStandards("step.fields", { count: gain.fields }) })
    : destination;

  const handleClick = () => onOpen(gain.standard);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t("chipHint", { standard: tStandards(`standard.${gain.standard}.name`) })}
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "hover:bg-secondary/70 cursor-pointer font-normal",
      )}
    >
      {label}
      <ChevronRight aria-hidden className="-mr-0.5" />
    </button>
  );
}
