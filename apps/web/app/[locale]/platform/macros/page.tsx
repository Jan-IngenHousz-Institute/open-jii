import { ListMacros } from "@/components/list-macros";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        title={t("macros.title")}
        description={t("macros.listDescription")}
        actions={
          <Link href={`/platform/macros/new`} locale={locale}>
            <Button>{t("macros.create")}</Button>
          </Link>
        }
      />
      <ListMacros />
    </PageContainer>
  );
}
