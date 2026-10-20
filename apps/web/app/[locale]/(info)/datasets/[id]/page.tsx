import { PublicDatasetView } from "@/components/datasets/page/public-dataset-view";
import { TranslationBundles } from "@/components/translation-bundles";

import { loadNamespaceBundles } from "@repo/i18n/server";

interface DatasetPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Outside `/platform`, so a DOI resolves here without an account. */
export default async function DatasetPage({ params }: DatasetPageProps) {
  const { locale, id } = await params;
  const bundles = await loadNamespaceBundles(locale, ["datasets"]);

  return (
    <TranslationBundles resources={bundles}>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
        <PublicDatasetView datasetId={id} />
      </div>
    </TranslationBundles>
  );
}
