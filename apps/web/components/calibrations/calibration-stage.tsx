"use client";

import type { ReactNode } from "react";

interface CalibrationStageProps {
  index: number;
  title: string;
  note?: string;
  summary?: ReactNode;
  children: ReactNode;
}

/** One stage of the procedure, numbered in the order a run executes it. */
export function CalibrationStage({ index, title, note, summary, children }: CalibrationStageProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-muted-foreground border-muted-foreground/40 flex size-6 shrink-0 translate-y-1 items-center justify-center rounded-full border text-[11px] tabular-nums">
          {index}
        </span>
        <h2 className="text-foreground text-[15px] font-semibold">{title}</h2>
        {note !== undefined && <span className="text-muted-foreground text-xs">{note}</span>}
        {summary !== undefined && (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">{summary}</span>
        )}
      </div>
      <div className="pl-8">{children}</div>
    </section>
  );
}
