import { DatasetsCatalogue } from "@/components/datasets/catalogue/datasets-catalogue";
import { TranslationBundles } from "@/components/translation-bundles";

import initTranslations, { loadNamespaceBundles } from "@repo/i18n/server";

interface PublicDatasetsPageProps {
  params: Promise<{ locale: string }>;
}

/** The catalogue outside `/platform`, for readers without an account. */
export default async function PublicDatasetsPage({ params }: PublicDatasetsPageProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, ["datasets"]);
  const { t } = await initTranslations({ locale, namespaces: ["datasets"] });

  return (
    <TranslationBundles resources={bundles}>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-12 md:py-16">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t("catalogue.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("catalogue.description")}</p>
        </div>
        <DatasetsCatalogue canFilterMine={false} />
      </div>
    </TranslationBundles>
  );
}
