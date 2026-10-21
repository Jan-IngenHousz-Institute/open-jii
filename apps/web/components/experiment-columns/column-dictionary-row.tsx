"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatLocaleNumber } from "@/util/format-locale-number";

import type {
  ColumnProducer,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { TableCell, TableRow } from "@repo/ui/components/table";

import type { ColumnStatus } from "./column-description-status";
import { ColumnDescriptionStatus } from "./column-description-status";

const TYPE_LABEL_KEYS: Partial<Record<string, string>> = {
  STRING: "dictionary.typeText",
  BOOLEAN: "dictionary.typeBoolean",
  TIMESTAMP: "dictionary.typeTimestamp",
};

function typeLabelKey(type: string): string | undefined {
  return isNumericType(type) ? "dictionary.typeNumber" : TYPE_LABEL_KEYS[type];
}

function columnStatus(column: DictionaryColumn, producer: ColumnProducer): ColumnStatus {
  if (producer.kind === "layout") {
    return "layout";
  }
  if (column.description !== null) {
    return "described";
  }
  return column.isSuggested ? "suggested" : "not-described";
}

function rowAction(canDescribe: boolean, isDescribed: boolean): "describe" | "edit" | "view" {
  if (!canDescribe) {
    return "view";
  }
  return isDescribed ? "edit" : "describe";
}

interface ColumnDictionaryRowProps {
  column: DictionaryColumn;
  producer: ColumnProducer;
  canDescribe: boolean;
  onSelect: (column: DictionaryColumn) => void;
}

export function ColumnDictionaryRow({
  column,
  producer,
  canDescribe,
  onSelect,
}: ColumnDictionaryRowProps) {
  const { t } = useTranslation("studyMetadata");
  const locale = useLocale();

  const status = columnStatus(column, producer);
  const isFromLayout = status === "layout";
  const isDescribed = status === "described";
  const labelKey = typeLabelKey(column.type);
  const typeLabel = labelKey ? t(labelKey) : column.type;
  const traitTerm = column.description?.traitTerm;

  const action = rowAction(canDescribe, isDescribed);

  const handleSelect = () => onSelect(column);

  return (
    <TableRow
      className={isFromLayout ? undefined : "cursor-pointer"}
      onClick={isFromLayout ? undefined : handleSelect}
    >
      <TableCell className="font-mono text-sm">{column.name}</TableCell>
      <TableCell className="text-muted-foreground">{typeLabel}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {formatLocaleNumber(column.rowCount, locale)}
      </TableCell>
      <TableCell>
        <ColumnDescriptionStatus status={status} />
      </TableCell>
      <TableCell>
        {column.description?.trait}
        {traitTerm && (
          <span className="text-muted-foreground ml-2 font-mono text-xs">{traitTerm.id}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {!isFromLayout && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t(`dictionary.${action}Column`, { name: column.name })}
          >
            {t(`dictionary.${action}`)}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
