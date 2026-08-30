import { ListWorkbooks } from "@/components/list-workbooks";
import { ResourceActivitySummary } from "@/components/metrics/resource-activity-summary";
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

export default function WorkbookPage(_props: WorkbookPageProps) {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <ResourceActivitySummary kind="workbook" />
      <ListWorkbooks />
    </PageContainer>
  );
}
