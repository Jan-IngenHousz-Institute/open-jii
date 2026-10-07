import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { WorkbookLayoutShell } from "@/components/workbook-overview/workbook-layout-shell";
import { workbookQuery } from "@/hooks/workbook/useWorkbook/useWorkbook";
import type { ReactNode } from "react";

interface WorkbookLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function WorkbookLayout({ children, params }: WorkbookLayoutProps) {
  const { id } = await params;

  return (
    <PrefetchedQueries queries={(utils) => [workbookQuery(utils, id)]}>
      <WorkbookLayoutShell>{children}</WorkbookLayoutShell>
    </PrefetchedQueries>
  );
}
