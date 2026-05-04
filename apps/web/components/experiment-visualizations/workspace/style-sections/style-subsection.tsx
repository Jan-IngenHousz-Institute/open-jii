"use client";

import type { ReactNode } from "react";

interface StyleSubsectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Small visual grouping for related controls inside a Style panel section.
 * Uses a tiny uppercase muted heading instead of a full `<h3>` so it adds
 * structure without overweighting the layout.
 */
export function StyleSubsection({ title, children }: StyleSubsectionProps) {
  return (
    <div className="space-y-2.5">
      <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
