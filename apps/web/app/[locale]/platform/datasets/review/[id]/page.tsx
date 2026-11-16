import { DatasetReviewView } from "@/components/datasets/review/dataset-review-view";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface DatasetReviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: DatasetReviewPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return { title: t("review.pageTitle") };
}

export default async function DatasetReviewPage({ params }: DatasetReviewPageProps) {
  const { id } = await params;

  return (
    <PageContainer width="fluid">
      <DatasetReviewView datasetId={id} />
    </PageContainer>
  );
}
