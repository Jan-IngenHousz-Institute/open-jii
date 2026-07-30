import { DocsHelpLink } from "@/components/docs-help-link";
import { NewExperimentForm } from "@/components/new-experiment/new-experiment";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface NewExperimentPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewExperimentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("experiments.newExperiment") };
}

export default async function NewExperimentPage({ params }: NewExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="reading" className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("experiments.newExperiment")}</h3>
        <p className="text-muted-foreground text-sm">{t("newExperiment.description")}</p>
        <div className="mt-2">
          <DocsHelpLink path="/guide/experiments/creating" />
        </div>
      </div>
      <NewExperimentForm />
    </PageContainer>
  );
}
