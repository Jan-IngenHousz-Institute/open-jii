import { ListMacros } from "@/components/list-macros";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

interface MacroPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: MacroPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["macro"] });

  return { title: t("macros.title") };
}

export default async function MacroPage({ params }: MacroPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["macro"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
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
    </PageContainer>
  );
}
