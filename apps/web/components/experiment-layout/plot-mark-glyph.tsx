import type { LucideIcon } from "lucide-react";
import { Check, Circle, MapPin, SkipForward, TriangleAlert, X } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

import type { PlotMark } from "./plot-state";

interface PlotMarkGlyphProps {
  mark: PlotMark | "removed";
  className?: string;
}

const GLYPHS: Record<PlotMark | "removed", { icon: LucideIcon; className: string }> = {
  measured: { icon: Check, className: "text-foreground" },
  skipped: { icon: SkipForward, className: "text-foreground" },
  current: { icon: MapPin, className: "text-primary fill-primary/20" },
  measuredTwice: { icon: TriangleAlert, className: "text-status-stale-foreground" },
  outsideShare: { icon: Circle, className: "text-foreground" },
  removed: { icon: X, className: "text-muted-foreground" },
};

export function PlotMarkGlyph({ mark, className }: PlotMarkGlyphProps) {
  const { icon: Icon, className: tone } = GLYPHS[mark];

  return (
    <Icon className={cn("size-3.5 shrink-0", tone, className)} strokeWidth={2.5} aria-hidden />
  );
}
