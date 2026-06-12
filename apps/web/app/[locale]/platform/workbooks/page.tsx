import { ListWorkbooks } from "@/features/workbooks/components/list-workbooks";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "Workbooks",
};

interface WorkbookPageProps {
  params: Promise<{ locale: string }>;
}

export default async function WorkbookPage({ params }: WorkbookPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["workbook"],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-gray-900">{t("workbooks.title")}</h1>
        <p>{t("workbooks.listDescription")}</p>
      </div>
      <ListWorkbooks />
    </div>
  );
}
