"use client";

import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

export type PortState = "idle" | "connecting" | "connected" | "failed";

interface CalibrationPortRowProps {
  state: PortState;
  /** The role this port plays, or the family of the device under test. */
  title: string;
  /** What it should answer, or what it did; absent before there is anything to say. */
  detail?: ReactNode;
  note?: ReactNode;
  action: ReactNode;
  /** A refusal worth its own line, in its own words. */
  children?: ReactNode;
}

const GLYPH: Record<PortState, typeof CircleDashed> = {
  idle: CircleDashed,
  connecting: Loader2,
  connected: CheckCircle2,
  failed: XCircle,
};

const GLYPH_TONE: Record<PortState, string> = {
  idle: "text-muted-foreground",
  connecting: "text-muted-foreground animate-spin",
  connected: "text-status-active",
  failed: "text-destructive",
};

/**
 * One port on the rig, in the one shape they all take: what it is, what answered, and the
 * single thing to do about it. The device under test is a port like any other.
 */
export function CalibrationPortRow({
  state,
  title,
  detail,
  note,
  action,
  children,
}: CalibrationPortRowProps) {
  const Glyph = GLYPH[state];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3">
      <Glyph className={cn("size-4 shrink-0", GLYPH_TONE[state])} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {detail !== undefined && <p className="text-muted-foreground text-xs">{detail}</p>}
        {note !== undefined && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      {action}
      {children !== undefined && <div className="w-full">{children}</div>}
    </div>
  );
}
