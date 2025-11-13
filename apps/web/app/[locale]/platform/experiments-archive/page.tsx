import { ListExperiments } from "@/components/list-experiments";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "Experiments Archive",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">{t("experiments.archiveTitle")}</h1>
        <p>{t("experiments.archiveDescription")}</p>
      </div>
      <ListExperiments archived={true} />
    </div>
  );
}
