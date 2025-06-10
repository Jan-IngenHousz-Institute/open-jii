import { NewExperimentForm } from "@/components/new-experiment";
import type { Metadata } from "next";

import type { Locale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "New experiment",
};

interface NewExperimentPageProps {
  params: { locale: Locale };
}

export default async function NewExperimentPage({
  params,
}: NewExperimentPageProps) {
  const { locale } = params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          {t("experiments.newExperiment")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("newExperiment.description")}
        </p>
      </div>
      <NewExperimentForm />
    </div>
  );
}
