import { ListMacros } from "@/components/list-macros";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { macrosListQuery } from "@/hooks/macro/useMacros/macros-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface MacroPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<MacroPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["macro"] });

  return { title: t("macros.title") };
}

export default async function MacroPage({ searchParams }: MacroPageProps) {
  // Only the default view is fetched ahead; a sorted view's input comes from the client's parsing.
  const { sort } = await searchParams;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="macro" />
      <PrefetchedQueries queries={(utils) => (sort ? [] : [macrosListQuery(utils, { page: 1 })])}>
        <ListMacros />
      </PrefetchedQueries>
    </PageContainer>
  );
}
