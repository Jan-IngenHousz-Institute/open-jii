"use client";

import { useLocale } from "@/hooks/useLocale";
import { Clock, Info, Lock } from "lucide-react";

import type { DatasetAuthor, DatasetContributor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

interface DatasetAuthorsNotesProps {
  authors: DatasetAuthor[];
  contributors: DatasetContributor[];
}

const fullName = (person: DatasetAuthor | DatasetContributor) =>
  `${person.givenName} ${person.familyName}`;

/** What the lists commit to. A missing ORCID iD never holds Freeze, a pending request does. */
export function DatasetAuthorsNotes({ authors, contributors }: DatasetAuthorsNotesProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });

  // Someone invited by email has no account yet, so cannot have connected ORCID.
  const withoutOrcid = authors
    .filter((author) => author.origin !== "email" && author.orcid === null)
    .map(fullName);
  const hasWithoutOrcid = withoutOrcid.length > 0;

  const waiting = [...authors, ...contributors]
    .filter((person) => person.request === "pending")
    .map(fullName);
  const hasWaiting = waiting.length > 0;

  return (
    <div className="space-y-2">
      {hasWithoutOrcid ? (
        <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
          <Info className="text-primary size-4 shrink-0" aria-hidden />
          <span className="leading-tight">
            {t("describe.orcidInfo", {
              count: withoutOrcid.length,
              names: list.format(withoutOrcid),
            })}
          </span>
        </div>
      ) : null}
      {hasWaiting ? (
        <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
          <Clock className="text-primary size-4 shrink-0" aria-hidden />
          <span className="leading-tight">
            {t("describe.requestInfo", { count: waiting.length, names: list.format(waiting) })}
          </span>
        </div>
      ) : null}
      <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
        <Lock className="text-primary size-4 shrink-0" aria-hidden />
        <span className="leading-tight">{t("describe.authorsFinal")}</span>
      </div>
    </div>
  );
}
