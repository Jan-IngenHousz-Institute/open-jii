import { ReviewQueue } from "@/components/datasets/review/review-queue";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface ReviewDatasetsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ReviewDatasetsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return { title: t("review.title") };
}

export default async function ReviewDatasetsPage({ params }: ReviewDatasetsPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("review.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("review.description")}</p>
      </div>
      <ReviewQueue />
    </PageContainer>
  );
}
