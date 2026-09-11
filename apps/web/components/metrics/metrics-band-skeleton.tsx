import { Card, CardFooter, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { metricsBandGrid } from "./metrics-band-grid";

interface MetricsBandSkeletonProps {
  cards: number;
  className?: string;
}

/** The band's own geometry while it loads, so nothing reflows when the figures arrive. */
export function MetricsBandSkeleton({ cards, className }: MetricsBandSkeletonProps) {
  const renderCard = (index: number) => (
    <Card key={index} padding="sm" className="@container/card">
      <CardHeader className="gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardFooter className="mt-auto flex-col items-start gap-0.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24" />
      </CardFooter>
    </Card>
  );

  return (
    // The caller passes the whole grid, gaps included, so this cannot drift
    // from the band it stands in for.
    <section aria-hidden className={cn(metricsBandGrid, className)}>
      {Array.from({ length: cards }, (_, index) => renderCard(index))}
    </section>
  );
}
