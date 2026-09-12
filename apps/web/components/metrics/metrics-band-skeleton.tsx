import { Card, CardFooter, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

interface MetricsBandSkeletonProps {
  cards: number;
  /**
   * The band's grid. Required rather than defaulted: a default of the
   * four-column band survives twMerge against a three-column caller, because
   * the tiers carry different modifiers, and the page reflows on load.
   */
  grid: string;
}

/** The band's own geometry while it loads, so nothing reflows when the figures arrive. */
export function MetricsBandSkeleton({ cards, grid }: MetricsBandSkeletonProps) {
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
    <section aria-hidden className={grid}>
      {Array.from({ length: cards }, (_, index) => renderCard(index))}
    </section>
  );
}
