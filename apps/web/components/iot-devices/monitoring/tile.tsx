"use client";

import { cn } from "@repo/ui/lib/utils";

/** One triage-row cell. The metrics bands use `MetricStatCard`; this is the denser row. */
export function Tile({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-3", className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1.5 text-sm font-medium">{children}</div>
    </div>
  );
}
