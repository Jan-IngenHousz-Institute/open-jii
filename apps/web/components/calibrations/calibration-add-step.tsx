"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import type { StepKind } from "./procedure-edits";
import { STEP_KINDS } from "./procedure-edits";
import { stepAppearance } from "./step-appearance";

interface CalibrationAddStepProps {
  /** Kinds that cannot be added here, with the reason shown in their tooltip. */
  unavailable?: Partial<Record<StepKind, string>>;
  variant?: "inline" | "bottom";
  onAdd: (kind: StepKind) => void;
}

/**
 * Where the next step goes.
 *
 * Between two cells it is a line that opens on hover, the way a cell is inserted anywhere
 * else in the platform; at the end of an empty phase it is a labelled row, because there
 * is nothing above it to insert after.
 */
export function CalibrationAddStep({
  unavailable = {},
  variant = "inline",
  onAdd,
}: CalibrationAddStepProps) {
  const { t } = useTranslation("iot");

  function renderIconButton(kind: StepKind) {
    const { icon: Icon, accent } = stepAppearance(kind);
    const reason = unavailable[kind];

    return (
      <Tooltip key={kind}>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hover:bg-muted h-7 w-7 rounded-full p-0"
              onClick={() => onAdd(kind)}
              disabled={reason !== undefined}
              aria-label={t(`iot.calibration.procedure.kindName.${kind}`)}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {reason ?? t(`iot.calibration.procedure.kind.${kind}`)}
        </TooltipContent>
      </Tooltip>
    );
  }

  function renderLabelledButton(kind: StepKind) {
    const { icon: Icon, accent } = stepAppearance(kind);
    const reason = unavailable[kind];

    return (
      <Tooltip key={kind}>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onAdd(kind)}
              disabled={reason !== undefined}
            >
              <Icon className="size-4" style={{ color: accent }} />
              {t(`iot.calibration.procedure.kindName.${kind}`)}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {reason ?? t(`iot.calibration.procedure.kind.${kind}`)}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "bottom") {
    return (
      <div className="border-border bg-canvas flex flex-col items-center justify-center gap-3 rounded-lg border p-4">
        <span className="text-muted-foreground text-[13px]">
          {t("iot.calibration.procedure.addStep")}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <TooltipProvider delayDuration={100}>
            {STEP_KINDS.map(renderLabelledButton)}
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="group/add py-2">
      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in-out group-hover/add:grid-rows-[1fr] has-[[data-state=open]]:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="relative flex items-center justify-center py-1">
            <div className="border-muted-foreground/20 absolute inset-x-0 top-1/2 border-t" />
            <div className="bg-background shadow-xs relative z-10 flex items-center gap-1 rounded-full border px-1 py-0.5">
              <TooltipProvider delayDuration={100}>
                {STEP_KINDS.map(renderIconButton)}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
