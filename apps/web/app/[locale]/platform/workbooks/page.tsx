import { ListWorkbooks } from "@/components/list-workbooks";
import { PageContainer } from "@/components/page-container";
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
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-gray-900">{t("workbooks.title")}</h1>
        <p>{t("workbooks.listDescription")}</p>
      </div>
      <ListWorkbooks />
    </PageContainer>
  );
}
