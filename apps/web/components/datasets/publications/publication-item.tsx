"use client";

import type { RelatedPublication } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { DatasetDoiLink } from "../dataset-doi-link";

export function PublicationItem({ publication }: { publication: RelatedPublication }) {
  const { t } = useTranslation("datasets");
  const authors = publication.authors.join(", ");
  const hasByline = authors !== "" && publication.year !== null;

  return (
    <li className="space-y-1">
      <p className="text-sm leading-snug">
        {publication.title ?? publication.doi ?? publication.url}
      </p>
      {hasByline ? (
        <p className="text-muted-foreground text-xs">
          {t("publications.byline", { authors, year: publication.year })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="font-normal">
          {t(`publications.relations.${publication.relation}`)}
        </Badge>
        {publication.doi !== null ? <DatasetDoiLink doi={publication.doi} /> : null}
      </div>
    </li>
  );
}
