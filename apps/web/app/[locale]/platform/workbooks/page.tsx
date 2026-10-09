import { ListWorkbooks } from "@/components/list-workbooks";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { workbooksListQuery } from "@/hooks/workbook/useWorkbooks/workbooks-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface WorkbookPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<WorkbookPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["workbook"] });

  return { title: t("workbooks.title") };
}

export default async function WorkbookPage({ searchParams }: WorkbookPageProps) {
  // Only the default view is fetched ahead; a sorted view's input comes from the client's parsing.
  const { sort } = await searchParams;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="workbook" />
      <PrefetchedQueries
        queries={(utils) => (sort ? [] : [workbooksListQuery(utils, { page: 1 })])}
      >
        <ListWorkbooks />
      </PrefetchedQueries>
    </PageContainer>
  );
}
