"use client";

import { Card } from "@repo/ui/components/card";
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
    <Card className="min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
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
    </Card>
  );
}
