"use client";

import type { ReactNode } from "react";

interface CalibrationStageProps {
  index: number;
  title: string;
  /** Marks a stage a definition can leave empty, so an empty one does not read as unfinished. */
  note?: string;
  children: ReactNode;
}

/**
 * One stage of the procedure, numbered in the order a run executes it.
 *
 * The four parts of a definition are not peers: the bench is a precondition, the capture
 * and the verification are phases of a run, and the fit sits between them. Numbering them
 * is what makes the document read as the thing it describes.
 */
export function CalibrationStage({ index, title, note, children }: CalibrationStageProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground border-muted-foreground/40 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums">
          {index}
        </span>
        <h2 className="text-foreground text-sm font-medium">{title}</h2>
        {note !== undefined && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>
      <div className="pl-7">{children}</div>
    </section>
  );
}
