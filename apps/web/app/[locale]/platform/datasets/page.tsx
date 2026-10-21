import { DatasetsCatalogue } from "@/components/datasets/catalogue/datasets-catalogue";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface DatasetsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: DatasetsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return { title: t("catalogue.title") };
}

export default async function DatasetsPage({ params }: DatasetsPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <p className="text-muted-foreground text-sm">{t("catalogue.description")}</p>
      <DatasetsCatalogue canFilterMine />
    </PageContainer>
  );
}
