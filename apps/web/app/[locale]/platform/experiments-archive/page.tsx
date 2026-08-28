import { ListExperiments } from "@/components/list-experiments";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ExperimentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.archiveTitle") };
}

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <PageHeader
        title={t("experiments.archiveTitle")}
        description={t("experiments.archiveDescription")}
      />
      <ListExperiments archived={true} />
    </PageContainer>
  );
}
