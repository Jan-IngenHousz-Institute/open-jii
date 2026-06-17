import { Skeleton } from "@repo/ui/components/skeleton";

interface SkeletonTableHeaderProps {
  columnCount: number;
}

export function SkeletonTableHeader({ columnCount }: SkeletonTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b">
        {Array.from({ length: columnCount }).map((_, index) => (
          <th key={index}>
            <Skeleton className="h-3 w-20" />
          </th>
        ))}
      </tr>
    </thead>
  );
}
