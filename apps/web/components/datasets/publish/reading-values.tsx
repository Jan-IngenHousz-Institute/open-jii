"use client";

import type { ReadingValue } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

/** A reading's measured values on one muted line, so two readings can be told apart. */
export function ReadingValues({ values }: { values: ReadingValue[] }) {
  const { t } = useTranslation("datasets");
  const line = values
    .map(({ column, value }) => t("curate.valueEntry", { column, value }))
    .join(", ");

  return <p className="text-muted-foreground text-xs tabular-nums">{line}</p>;
}
