import { ListExperiments } from "@/components/list-experiments";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ExperimentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.title") };
}

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <PageHeader
        title={t("experiments.title")}
        description={t("experiments.listDescription")}
        actions={
          <>
            <Link href={`/${locale}/platform/transfer-request`}>
              <Button variant="secondary">{t("transferRequest.title")}</Button>
            </Link>
            <Link href={`/platform/experiments/new`} locale={locale}>
              <Button>{t("experiments.create")}</Button>
            </Link>
          </>
        }
      >
        <Link href={`/${locale}/platform/experiments-archive`}>
          <Button variant="link" className="!p-0">
            {t("experiments.viewArchived")}
          </Button>
        </Link>
      </PageHeader>

      <ListExperiments />
    </PageContainer>
  );
}
