import { ListExperiments } from "@/components/list-experiments";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { experimentsListQuery } from "@/hooks/experiment/useExperiments/experiments-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; visibility?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<ExperimentPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.archiveTitle") };
}

export default async function ExperimentPage({ searchParams }: ExperimentPageProps) {
  // Only the default view is fetched ahead; a sorted or filtered view's input comes from the
  // client's parsing. The archive ignores `status`, so it does not change the view.
  const { sort, visibility } = await searchParams;
  const isDefaultView = !sort && !visibility;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <PrefetchedQueries
        queries={(utils) =>
          isDefaultView ? [experimentsListQuery(utils, { archived: true, page: 1 })] : []
        }
      >
        <ListExperiments archived={true} />
      </PrefetchedQueries>
    </PageContainer>
  );
}
