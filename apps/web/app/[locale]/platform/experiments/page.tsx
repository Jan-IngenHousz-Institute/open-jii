import { ListExperiments } from "@/components/list-experiments";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { experimentsListQuery } from "@/hooks/experiment/useExperiments/experiments-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; status?: string; visibility?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<ExperimentPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.title") };
}

/** Prefetch page 1 only when search, sort, status and visibility are empty. */
export default async function ExperimentPage({ searchParams }: ExperimentPageProps) {
  // Only the default view is fetched ahead; other views use the client's parsing.
  const { q, sort, status, visibility } = await searchParams;
  const isDefaultView = !q && !sort && !status && !visibility;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="experiment" />
      <PrefetchedQueries
        queries={(utils) =>
          isDefaultView ? [experimentsListQuery(utils, { archived: false, page: 1 })] : []
        }
      >
        <ListExperiments />
      </PrefetchedQueries>
    </PageContainer>
  );
}
