import { GuestGate } from "@/components/auth/guest-gate";
import { ListProtocols } from "@/components/list-protocols";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { protocolsListQuery } from "@/hooks/protocol/useProtocols/protocols-list-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ProtocolPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; family?: string; visibility?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<ProtocolPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("protocols.title") };
}

export default async function ProtocolPage({ searchParams }: ProtocolPageProps) {
  // Only the default view is fetched ahead; a sorted or filtered view's input comes from the
  // client's parsing.
  const { sort, family, visibility } = await searchParams;
  const isDefaultView = !sort && !family && !visibility;

  return (
    <PageContainer width="fluid" className="space-y-6">
      <GuestGate procedure="metrics.getResourceMetrics">
        <ResourceMetricsSummary kind="protocol" />
      </GuestGate>
      <PrefetchedQueries
        queries={(utils) => (isDefaultView ? [protocolsListQuery(utils, { page: 1 })] : [])}
      >
        <ListProtocols />
      </PrefetchedQueries>
    </PageContainer>
  );
}
