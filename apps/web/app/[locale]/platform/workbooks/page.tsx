import { ListWorkbooks } from "@/components/list-workbooks";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

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
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("workbooks.title")}</h1>
          <p>{t("workbooks.listDescription")}</p>
        </div>
        <Link href={`/platform/workbooks/new`} locale={locale}>
          <Button>{t("workbooks.create")}</Button>
        </Link>
      </div>
      <ListWorkbooks />
    </div>
  );
}
