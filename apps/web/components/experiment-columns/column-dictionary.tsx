"use client";

import { useExperimentColumnDictionary } from "@/hooks/experiment/useExperimentColumnDictionary/useExperimentColumnDictionary";
import { useState } from "react";

import type {
  ColumnProducer,
  DictionaryColumn,
  DictionaryGroup,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import type { SelectedColumn } from "./column-describe-drawer";
import { ColumnDescribeDrawer } from "./column-describe-drawer";
import { ColumnDictionaryGroup } from "./column-dictionary-group";

interface ColumnDictionaryProps {
  experimentId: string;
}

/** Every column the experiment has produced, grouped by what produced it. */
export function ColumnDictionary({ experimentId }: ColumnDictionaryProps) {
  const { t } = useTranslation("studyMetadata");
  const { data, isLoading, error } = useExperimentColumnDictionary(experimentId);
  const [selected, setSelected] = useState<SelectedColumn | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{t("dictionary.loadFailed")}</p>;
  }

  const columns = data.groups.flatMap((group) => group.columns);
  const describedCount = columns.filter((column) => column.description !== null).length;

  const handleSelectColumn = (column: DictionaryColumn, producer: ColumnProducer) =>
    setSelected({ column, producer });

  const handleCloseDrawer = () => setSelected(null);

  const renderGroup = (group: DictionaryGroup, index: number) => (
    <ColumnDictionaryGroup key={index} group={group} onSelectColumn={handleSelectColumn} />
  );

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {t("dictionary.describedCount", { described: describedCount, total: columns.length })}
      </p>
      {data.groups.map(renderGroup)}
      <ColumnDescribeDrawer
        experimentId={experimentId}
        selected={selected}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
