"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatLocaleNumber } from "@/util/format-locale-number";

import type { DictionaryColumn } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { ColumnDescriptionStatus } from "./column-description-status";

const TYPE_LABEL_KEYS: Partial<Record<string, string>> = {
  STRING: "dictionary.typeText",
  BOOLEAN: "dictionary.typeBoolean",
  TIMESTAMP: "dictionary.typeTimestamp",
};

function typeLabelKey(type: string): string | undefined {
  return isNumericType(type) ? "dictionary.typeNumber" : TYPE_LABEL_KEYS[type];
}

interface ColumnDictionaryRowProps {
  column: DictionaryColumn;
  onSelect: (column: DictionaryColumn) => void;
}

export function ColumnDictionaryRow({ column, onSelect }: ColumnDictionaryRowProps) {
  const { t } = useTranslation("studyMetadata");
  const locale = useLocale();

  const labelKey = typeLabelKey(column.type);
  const typeLabel = labelKey ? t(labelKey) : column.type;
  const isDescribed = column.description !== null;
  const traitTerm = column.description?.traitTerm;

  const handleSelect = () => onSelect(column);

  // The row takes the click; the button is there for keyboard users.
  const handleButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onSelect(column);
  };

  return (
    <TableRow className="cursor-pointer" onClick={handleSelect}>
      <TableCell className="font-mono text-sm">
        <button type="button" className="hover:underline" onClick={handleButtonClick}>
          {column.name}
        </button>
      </TableCell>
      <TableCell className="text-muted-foreground">{typeLabel}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {formatLocaleNumber(column.rowCount, locale)}
      </TableCell>
      <TableCell>
        <ColumnDescriptionStatus isDescribed={isDescribed} />
      </TableCell>
      <TableCell>
        {column.description?.trait}
        {traitTerm && (
          <span className="text-muted-foreground ml-2 font-mono text-xs">{traitTerm.id}</span>
        )}
      </TableCell>
    </TableRow>
  );
}
