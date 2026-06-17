"use client";

import { Skeleton } from "@repo/ui/components/skeleton";

export function ColumnPickerSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-background flex h-8 items-center gap-2 rounded-md border px-2">
          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 min-w-0 flex-1" />
          <Skeleton className="h-2.5 w-10 shrink-0" />
        </div>
      ))}
      <Skeleton className="h-7 w-full rounded-md border border-dashed bg-transparent" />
    </div>
  );
}
