import { ListExperiments } from "@/components/list-experiments";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ExperimentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.title") };
}

export default function ExperimentPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="experiment" />
      <ListExperiments />
    </PageContainer>
  );
}
