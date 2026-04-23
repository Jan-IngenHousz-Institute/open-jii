import { ListMacros } from "@/components/list-macros";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

export const metadata: Metadata = {
  title: "Macros",
};

interface MacroPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MacroPage({ params }: MacroPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["macro"],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("macros.title")}</h1>
          <p>{t("macros.listDescription")}</p>
        </div>
        <Link href={`/platform/macros/new`} locale={locale}>
          <Button>{t("macros.create")}</Button>
        </Link>
      </div>
      <ListMacros />
    </div>
  );
}
