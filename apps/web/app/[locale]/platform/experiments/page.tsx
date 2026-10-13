import { ListExperiments } from "@/components/list-experiments";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { experimentsListQuery } from "@/hooks/experiment/useExperiments/experiments-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<ExperimentPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.title") };
}

export default async function ExperimentPage({ searchParams }: ExperimentPageProps) {
  // Only the default view is fetched ahead; a sorted view's input comes from the client's parsing.
  const { sort } = await searchParams;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="experiment" />
      <PrefetchedQueries
        queries={(utils) =>
          sort ? [] : [experimentsListQuery(utils, { archived: false, page: 1 })]
        }
      >
        <ListExperiments />
      </PrefetchedQueries>
    </PageContainer>
  );
}
