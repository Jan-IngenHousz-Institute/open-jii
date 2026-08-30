import { ListMacros } from "@/components/list-macros";
import { ResourceMetricsSummary } from "@/components/metrics/resource-metrics-summary";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface MacroPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: MacroPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["macro"] });

  return { title: t("macros.title") };
}

export default function MacroPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceMetricsSummary kind="macro" />
      <ListMacros />
    </PageContainer>
  );
}
