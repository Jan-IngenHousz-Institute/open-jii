import { GuestGate } from "@/components/auth/guest-gate";
import { ListMacros } from "@/components/list-macros";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { macrosListQuery } from "@/hooks/macro/useMacros/macros-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface MacroPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; language?: string; visibility?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<MacroPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["macro"] });

  return { title: t("macros.title") };
}

export default async function MacroPage({ searchParams }: MacroPageProps) {
  // Only the default view is fetched ahead; a sorted or filtered view's input comes from the
  // client's parsing.
  const { sort, language, visibility } = await searchParams;
  const isDefaultView = !sort && !language && !visibility;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <GuestGate procedure="metrics.getResourceMetrics">
        <ResourceMetricsSummary kind="macro" />
      </GuestGate>
      <PrefetchedQueries
        queries={(utils) => (isDefaultView ? [macrosListQuery(utils, { page: 1 })] : [])}
      >
        <ListMacros />
      </PrefetchedQueries>
    </PageContainer>
  );
}
