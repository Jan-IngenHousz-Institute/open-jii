"use client";

import { useLocale } from "@/hooks/useLocale";
import { Clock, Info, Lock } from "lucide-react";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

/** What the author list commits to. A missing ORCID iD never holds Freeze, a pending request does. */
export function DatasetAuthorsNotes({ authors }: { authors: DatasetAuthor[] }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();

  // Only a member can connect ORCID, so an author added by name is never named here.
  const withoutOrcid = authors
    .filter((author) => author.userId !== null && author.orcid === null)
    .map((author) => `${author.givenName} ${author.familyName}`);
  const hasWithoutOrcid = withoutOrcid.length > 0;
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const names = list.format(withoutOrcid);

  const waiting = authors
    .filter((author) => author.request === "pending")
    .map((author) => `${author.givenName} ${author.familyName}`);
  const hasWaiting = waiting.length > 0;

  return (
    <div className="space-y-2">
      {hasWithoutOrcid ? (
        <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
          <Info className="text-primary size-4 shrink-0" aria-hidden />
          <span className="leading-tight">
            {t("describe.orcidInfo", { count: withoutOrcid.length, names })}
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
