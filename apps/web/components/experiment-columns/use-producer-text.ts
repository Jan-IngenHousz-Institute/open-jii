import type { ColumnProducer } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";

interface ProducerText {
  title: string;
  caption: string;
}

/** What names a column's origin: the workbook and its version, the macro, the layout or nothing. */
export function useProducerText(): (producer: ColumnProducer) => ProducerText {
  const { t } = useTranslation("studyMetadata");

  return (producer) => {
    switch (producer.kind) {
      case "instrument":
        return {
          title: producer.workbookName
            ? t("dictionary.producerWorkbook", {
                name: producer.workbookName,
                version: producer.workbookVersion,
              })
            : t("dictionary.producerWorkbookUnnamed", { version: producer.workbookVersion }),
          caption: t("dictionary.producerInstrumentCaption"),
        };
      case "macro":
        return {
          title: t("dictionary.producerMacro", { name: producer.macroName }),
          caption: t("dictionary.producerMacroCaption"),
        };
      case "layout":
        return {
          title: t("dictionary.producerLayout"),
          caption: t("dictionary.producerLayoutCaption"),
        };
      case "unknown":
        return {
          title: t("dictionary.producerUnknown"),
          caption: t("dictionary.producerUnknownCaption"),
        };
    }
  };
}
