import type { ColumnProducer } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";

interface ProducerText {
  title: string;
  caption: string;
  /** How the producer made the column's values, which a new description starts its method from. */
  method: string | null;
}

/** What names a column's origin: a workbook version, a macro, an upload, the layout or nothing. */
export function useProducerText(): (producer: ColumnProducer) => ProducerText {
  const { t } = useTranslation("studyMetadata");

  const instrumentMethod = (producer: Extract<ColumnProducer, { kind: "instrument" }>) =>
    producer.instrumentFamily && producer.workbookName
      ? t("describe.methodInstrument", {
          family: producer.instrumentFamily,
          name: producer.workbookName,
          version: producer.workbookVersion,
        })
      : t("describe.methodInstrumentUnnamed", { version: producer.workbookVersion });

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
          caption: producer.instrumentFamily
            ? t("dictionary.producerFamilyCaption", { family: producer.instrumentFamily })
            : t("dictionary.producerInstrumentCaption"),
          method: instrumentMethod(producer),
        };
      case "macro":
        return {
          title: t("dictionary.producerMacro", { name: producer.macroName }),
          caption: t("dictionary.producerMacroCaption"),
          method: t("describe.methodMacro", { name: producer.macroName }),
        };
      case "upload":
        return {
          title: t("dictionary.producerUpload", {
            parser: producer.parserName,
            version: producer.parserVersion,
          }),
          caption: t("dictionary.producerUploadCaption", { parser: producer.parserName }),
          method: t("describe.methodUpload", {
            parser: producer.parserName,
            version: producer.parserVersion,
          }),
        };
      case "layout":
        return {
          title: t("dictionary.producerLayout"),
          caption: t("dictionary.producerLayoutCaption"),
          method: null,
        };
      case "unknown":
        return {
          title: t("dictionary.producerUnknown"),
          caption: t("dictionary.producerUnknownCaption"),
          method: null,
        };
    }
  };
}
