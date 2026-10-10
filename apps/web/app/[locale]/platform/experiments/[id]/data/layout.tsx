import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { experimentTablesQuery } from "@/hooks/experiment/useExperimentTables/experiment-tables-query";
import type { ReactNode } from "react";

interface DataLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

// The table reads its first page only once it knows the tables, so the list comes with the page.
export default async function DataLayout({ children, params }: DataLayoutProps) {
  const { id } = await params;

  return (
    <PrefetchedQueries queries={(utils) => [experimentTablesQuery(utils, id)]}>
      {children}
    </PrefetchedQueries>
  );
}
