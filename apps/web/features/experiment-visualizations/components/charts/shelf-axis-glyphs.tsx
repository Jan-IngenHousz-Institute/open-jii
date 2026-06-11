"use client";

import { cn } from "@repo/ui/lib/utils";

// Single-letter axis glyph; visible only below md, where the full
// "X axis" / "Y axis" label collapses. Shared by every chart's shelf
// definitions so an axis trigger reads the same way across types.
function makeAxisGlyph(letter: string) {
  return function AxisGlyph({ className }: { className?: string }) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center font-mono text-[11px] font-semibold leading-none md:hidden",
          className,
        )}
      >
        {letter}
      </span>
    );
  };
}

export const XAxisGlyph = makeAxisGlyph("X");
export const YAxisGlyph = makeAxisGlyph("Y");
