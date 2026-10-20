"use client";

import type {
  ColumnProducer,
  DictionaryColumn,
  DictionaryGroup,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { ColumnDictionaryRow } from "./column-dictionary-row";
import { ColumnProducerLabel } from "./column-producer-label";

interface ColumnDictionaryGroupProps {
  group: DictionaryGroup;
  onSelectColumn: (column: DictionaryColumn, producer: ColumnProducer) => void;
}

export function ColumnDictionaryGroup({ group, onSelectColumn }: ColumnDictionaryGroupProps) {
  const { t } = useTranslation("studyMetadata");

  const handleSelect = (column: DictionaryColumn) => onSelectColumn(column, group.producer);

  const renderRow = (column: DictionaryColumn) => (
    <ColumnDictionaryRow key={column.identity} column={column} onSelect={handleSelect} />
  );

  return (
    <section className="space-y-3">
      <h5 className="text-base font-medium">
        <ColumnProducerLabel producer={group.producer} />
      </h5>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">{t("dictionary.column")}</TableHead>
              <TableHead className="w-28">{t("dictionary.type")}</TableHead>
              <TableHead className="w-28 text-right">{t("dictionary.rows")}</TableHead>
              <TableHead className="w-44">{t("dictionary.status")}</TableHead>
              <TableHead>{t("dictionary.trait")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{group.columns.map(renderRow)}</TableBody>
        </Table>
      </div>
    </section>
  );
}
