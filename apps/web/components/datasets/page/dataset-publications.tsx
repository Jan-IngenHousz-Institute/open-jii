"use client";

import type { RelatedPublication } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { PublicationItem } from "../publications/publication-item";

/** The papers copied from the experiment at freeze, or added to the record later. */
export function DatasetPublications({ publications }: { publications: RelatedPublication[] }) {
  const { t } = useTranslation("datasets");

  const renderPublication = (publication: RelatedPublication) => (
    <PublicationItem key={publication.id} publication={publication} />
  );

  return (
    <section className="space-y-2" data-testid="dataset-publications">
      <h2 className="text-lg font-semibold">{t("page.publications")}</h2>
      <ul className="space-y-3">{publications.map(renderPublication)}</ul>
    </section>
  );
}
