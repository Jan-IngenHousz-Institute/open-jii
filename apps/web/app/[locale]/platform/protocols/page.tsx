import { ListProtocols } from "@/components/list-protocols";
import { ResourceActivitySummary } from "@/components/metrics/resource-activity-summary";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ProtocolPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ProtocolPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("protocols.title") };
}

export default function ProtocolPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceActivitySummary kind="protocol" />
      <ListProtocols />
    </PageContainer>
  );
}
