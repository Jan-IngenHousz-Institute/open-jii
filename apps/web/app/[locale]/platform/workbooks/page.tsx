import { ListWorkbooks } from "@/components/list-workbooks";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface WorkbookPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: WorkbookPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["workbook"] });

  return { title: t("workbooks.title") };
}

export default async function WorkbookPage({ params }: WorkbookPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["workbook"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <PageHeader title={t("workbooks.title")} description={t("workbooks.listDescription")} />
      <ListWorkbooks />
    </PageContainer>
  );
}
