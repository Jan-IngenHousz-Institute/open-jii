import { Card, CardFooter, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

interface MetricsBandSkeletonProps {
  /** How many cards the band will hold once it loads. */
  cards: number;
  className?: string;
}

/**
 * The band's own shape while it loads, so the page does not reflow when the
 * figures arrive. Same card geometry as the real thing.
 */
export function MetricsBandSkeleton({ cards, className }: MetricsBandSkeletonProps) {
  const renderCard = (index: number) => (
    <Card key={index} className="@container/card gap-2 py-3">
      <CardHeader className="gap-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-24" />
      </CardHeader>
      <CardFooter className="mt-auto flex-col items-start gap-1">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-24" />
      </CardFooter>
    </Card>
  );

  return (
    <section aria-hidden className={cn("grid gap-4", className)}>
      {Array.from({ length: cards }, (_, index) => renderCard(index))}
    </section>
  );
}
