"use client";

import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";

export function UploadHistoryLoading() {
  return (
    <ScrollArea className="max-h-[280px]">
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </ScrollArea>
  );
}

function SkeletonRow() {
  return (
    <div className="flex min-h-[56px] items-center gap-3 rounded-lg border border-l-4 border-l-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:border-l-gray-600 dark:bg-gray-800">
      <Skeleton className="h-7 w-7 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-3 w-14 rounded" />
        </div>
      </div>
    </div>
  );
}
