import { ListExperiments } from "@/components/list-experiments";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

export const metadata: Metadata = {
  title: "Experiments",
};

interface ExperimentPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        {/* Left: title, description and archive link */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("experiments.title")}</h1>
          <p>{t("experiments.listDescription")}</p>

          <Link href={`/${locale}/platform/experiments-archive`}>
            <Button variant="link" className="!p-0">
              {t("experiments.viewArchived")}
            </Button>
          </Link>
        </div>

        {/* Right: actions (create, transfer) */}
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:gap-4">
          <Link href={`/${locale}/platform/transfer-request`} className="w-full md:w-auto">
            <Button variant="secondary" className="w-full md:w-auto">
              {t("transferRequest.title")}
            </Button>
          </Link>
          <Link href={`/platform/experiments/new`} locale={locale} className="w-full md:w-auto">
            <Button className="w-full md:w-auto">{t("experiments.create")}</Button>
          </Link>
        </div>
      </div>

      <ListExperiments />
    </PageContainer>
  );
}
