"use client";

import * as React from "react";

import { cn } from "../lib/utils";
import { cva } from "../lib/utils";

const stepCircle = cva(
  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-all duration-300 ease-in-out",
  {
    variants: {
      state: {
        default: "bg-background text-muted-foreground border-input",
        completed: "bg-primary/80 text-primary-foreground",
        active: "bg-primary text-primary-foreground scale-110 shadow-md",
      },
    },
    defaultVariants: { state: "default" },
  },
);

const stepTitle = cva(
  "mt-2 text-center text-xs font-medium transition-all duration-300 ease-in-out",
  {
    variants: {
      state: {
        default: "text-muted-foreground opacity-70",
        completed: "text-primary/80 opacity-80",
        active: "text-primary translate-y-0 opacity-100",
      },
    },
    defaultVariants: { state: "default" },
  },
);

const connectorLine = cva(
  "bg-primary/80 absolute left-0 top-0 h-full transition-all duration-500 ease-in-out",
  {
    variants: {
      state: {
        incomplete: "w-0",
        complete: "w-full",
      },
    },
    defaultVariants: { state: "incomplete" },
  },
);

export interface WizardStepIndicatorProps {
  /** Step titles in order; each circle shows its position, counted from 1. */
  steps: readonly string[];
  currentIndex: number;
  /**
   * Where inside the current step the flow has got to, shown under its title. A flow whose
   * circles are phases rather than screens needs somewhere to name the screen.
   */
  detail?: string;
  showTitles?: boolean;
  className?: string;
}

/**
 * The numbered rail a multi-step flow shows above its current step: one circle per step,
 * joined by a line that fills as steps complete. Shared so a flow that is not a form reads
 * the same as one that is.
 */
export function WizardStepIndicator({
  steps,
  currentIndex,
  detail,
  showTitles = true,
  className,
}: WizardStepIndicatorProps) {
  function renderStep(title: string, index: number) {
    const isActive = index === currentIndex;
    const isCompleted = index < currentIndex;
    const stepState = isActive ? "active" : isCompleted ? "completed" : "default";
    const connectorState = isCompleted ? "complete" : "incomplete";
    const isLast = index === steps.length - 1;

    return (
      <React.Fragment key={index}>
        <div
          className="flex w-[50px] flex-col items-center transition-all duration-300 md:w-[80px]"
          aria-current={isActive ? "step" : undefined}
        >
          <div className={stepCircle({ state: stepState })}>{index + 1}</div>
          {showTitles && <div className={stepTitle({ state: stepState })}>{title}</div>}
          {showTitles && isActive && detail !== undefined && (
            <div className="text-muted-foreground mt-0.5 text-center text-[11px]">{detail}</div>
          )}
        </div>

        {!isLast && (
          <div className="flex flex-1 items-start pt-4">
            <div className="bg-border relative h-[2px] w-full overflow-hidden rounded-full">
              <div className={connectorLine({ state: connectorState })} />
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  return <div className={cn("flex items-start gap-1", className)}>{steps.map(renderStep)}</div>;
}
