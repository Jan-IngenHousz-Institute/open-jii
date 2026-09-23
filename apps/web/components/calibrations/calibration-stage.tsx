"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import type { ReactNode } from "react";

interface CalibrationStageProps {
  index: number;
  title: string;
  note?: string;
  summary?: ReactNode;
  children: ReactNode;
}

/**
 * One stage of the procedure, numbered in the order a run executes it.
 *
 * The platform's own section chrome rather than a hand-rolled heading: four stages down a
 * long page need a boundary a reader can see, and this is the one every other surface uses.
 */
export function CalibrationStage({ index, title, note, summary, children }: CalibrationStageProps) {
  return (
    <SettingsCard
      title={
        <span className="flex items-center gap-2.5">
          <span className="text-muted-foreground border-muted-foreground/40 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-normal tabular-nums">
            {index}
          </span>
          {title}
          {note !== undefined && (
            <span className="text-muted-foreground text-xs font-normal">{note}</span>
          )}
        </span>
      }
      action={
        summary === undefined ? undefined : (
          <span className="text-muted-foreground text-xs tabular-nums">{summary}</span>
        )
      }
      contentClassName="space-y-4"
    >
      {children}
    </SettingsCard>
  );
}
