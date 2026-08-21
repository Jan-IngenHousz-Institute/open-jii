import { ListProtocols } from "@/components/list-protocols";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

interface ProtocolPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ProtocolPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("protocols.title") };
}

export default async function ProtocolPage({ params }: ProtocolPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <PageHeader
        title={t("protocols.title")}
        description={t("protocols.listDescription")}
        actions={
          <Link href={`/platform/protocols/new`} locale={locale}>
            <Button>{t("protocols.create")}</Button>
          </Link>
        }
      />
      <ListProtocols />
    </PageContainer>
  );
}
