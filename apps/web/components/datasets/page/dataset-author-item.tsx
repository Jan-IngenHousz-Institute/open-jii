"use client";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

export function DatasetAuthorItem({ author }: { author: DatasetAuthor }) {
  const { t } = useTranslation("datasets");
  const name = `${author.givenName} ${author.familyName}`;

  return (
    <li className="inline-flex items-center gap-1.5">
      <span className="font-medium">{name}</span>
      {author.orcid !== null ? (
        <a
          href={`https://orcid.org/${author.orcid}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t("describe.orcidLabel", { orcid: author.orcid })}
        >
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {t("describe.orcidMark")}
          </Badge>
        </a>
      ) : null}
      {author.affiliation !== null ? (
        <span className="text-muted-foreground">{author.affiliation}</span>
      ) : null}
    </li>
  );
}
