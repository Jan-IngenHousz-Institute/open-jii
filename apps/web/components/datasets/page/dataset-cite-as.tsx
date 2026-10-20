"use client";

import { Quote } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { CopyButton } from "@repo/ui/components/copy-button";

/** The citation as the record states it, built once on the server so every copy reads the same. */
export function DatasetCiteAs({ citation }: { citation: string }) {
  const { t } = useTranslation("datasets");

  return (
    <section className="bg-card rounded-lg border p-4" data-testid="dataset-cite-as">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Quote className="text-primary size-4" aria-hidden />
          {t("page.citeAs")}
        </h2>
        <CopyButton
          value={citation}
          label={t("page.copy")}
          copiedLabel={t("page.copied")}
          variant="outline"
          className="size-8"
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed">{citation}</p>
    </section>
  );
}
