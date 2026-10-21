"use client";

import type {
  DictionaryColumn,
  DictionaryGroup,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";

import { ColumnDictionaryRow } from "./column-dictionary-row";
import { useProducerText } from "./use-producer-text";

interface ColumnDictionaryGroupProps {
  group: DictionaryGroup;
  canDescribe: boolean;
  onSelectColumn: (column: DictionaryColumn) => void;
}

export function ColumnDictionaryGroup({
  group,
  canDescribe,
  onSelectColumn,
}: ColumnDictionaryGroupProps) {
  const { t } = useTranslation("studyMetadata");
  const producerText = useProducerText();
  const { title, caption } = producerText(group.producer);

  const renderRow = (column: DictionaryColumn) => (
    <ColumnDictionaryRow
      key={column.identity}
      column={column}
      producer={group.producer}
      canDescribe={canDescribe}
      onSelect={onSelectColumn}
    />
  );

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h5 className="text-base font-medium">{title}</h5>
        <p className="text-muted-foreground text-sm">{caption}</p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">{t("dictionary.column")}</TableHead>
              <TableHead className="w-28">{t("dictionary.type")}</TableHead>
              <TableHead className="w-28 text-right">{t("dictionary.rows")}</TableHead>
              <TableHead className="w-44">{t("dictionary.status")}</TableHead>
              <TableHead>{t("dictionary.trait")}</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">{t("dictionary.describe")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{group.columns.map(renderRow)}</TableBody>
        </Table>
      </div>
    </section>
  );
}
