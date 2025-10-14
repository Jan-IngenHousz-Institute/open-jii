import { ListExperiments } from "@/components/list-experiments";
import type { Metadata } from "next";
import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "Experiments",
};

interface ExperimentPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* Left: title, description and archive link */}
        <div>
          <h1 className="text-lg font-medium">{t("experiments.title")}</h1>
          <p>{t("experiments.listDescription")}</p>

          <Link href={`/${locale}/platform/experiments-archive`}>
            <Button variant="link" className="!p-0">
              {t("experiments.viewArchived")}
            </Button>
          </Link>
        </div>

        {/* Right: actions (create) */}
        <div>
          <Link href={`/platform/experiments/new`} locale={locale}>
            <Button>{t("experiments.create")}</Button>
          </Link>
        </div>
      </div>

      <ListExperiments />
    </div>
  );
}
