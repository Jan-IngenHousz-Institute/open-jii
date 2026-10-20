"use client";

import type { ColumnProducer } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";

interface ColumnProducerLabelProps {
  producer: ColumnProducer;
}

/** Names what produced a column: an instrument under a workbook version, or a macro. */
export function ColumnProducerLabel({ producer }: ColumnProducerLabelProps) {
  const { t } = useTranslation("studyMetadata");

  switch (producer.kind) {
    case "instrument":
      return <>{t("dictionary.producerInstrument", { version: producer.workbookVersion })}</>;
    case "macro":
      return <>{t("dictionary.producerMacro", { name: producer.macroName })}</>;
    case "unknown":
      return <>{t("dictionary.producerUnknown")}</>;
  }
}
