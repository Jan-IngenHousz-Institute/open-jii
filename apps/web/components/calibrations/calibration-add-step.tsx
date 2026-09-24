"use client";

import { Plus } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import type { StepKind } from "./procedure-edits";
import { STEP_KINDS } from "./procedure-edits";
import { stepAppearance } from "./step-appearance";

interface CalibrationAddStepProps {
  /** Kinds this phase cannot take yet, and why. */
  unavailable?: Partial<Record<StepKind, string>>;
  variant?: "inline" | "bottom";
  onAdd: (kind: StepKind) => void;
}

/** One quiet action under the list, since adding a step is rarer than reading one. */
export function CalibrationAddStep({ unavailable = {}, onAdd }: CalibrationAddStepProps) {
  const { t } = useTranslation("iot");

  function renderKind(kind: StepKind) {
    const { icon: Icon } = stepAppearance(kind);
    const reason = unavailable[kind];

    return (
      <DropdownMenuItem
        key={kind}
        disabled={reason !== undefined}
        onSelect={() => onAdd(kind)}
        className="flex-col items-start gap-0.5"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-3.5" aria-hidden />
          {t(`iot.calibration.procedure.kindName.${kind}`)}
        </span>
        <span className="text-muted-foreground pl-5.5 text-[11px]">
          {reason ?? t(`iot.calibration.procedure.kind.${kind}`)}
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2.5 h-7"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("iot.calibration.procedure.addStep")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {STEP_KINDS.map(renderKind)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
