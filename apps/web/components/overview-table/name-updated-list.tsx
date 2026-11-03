"use client";

import { useNameUpdatedListSort } from "@/hooks/useNameUpdatedListSort";
import { useOverviewSortLabels } from "@/hooks/useOverviewSortLabels";
import { sortByNameAndUpdated } from "@/util/name-updated-sort";
import { useMemo } from "react";

import type { OverviewTableColumn } from "./overview-table";
import { createOverviewTableSorting, OverviewTable } from "./overview-table";
import { ResetSortingButton } from "./reset-sorting-button";

interface NamedAndUpdated {
  id: string;
  name: string;
  updatedAt: string;
}

interface NameUpdatedListProps<T extends NamedAndUpdated> {
  items: T[];
  columns: OverviewTableColumn<T>[];
  getRowHref: (item: T) => string;
  countLabel: (count: number) => string;
  isLoading?: boolean;
  emptyMessage: string;
  emptyHelpPath?: string;
}

/**
 * A table of rows that are all loaded at once, sortable by name and update from the headers,
 * newest update first by default. Sorting stays in the browser; the sort is kept in the URL.
 */
export function NameUpdatedList<T extends NamedAndUpdated>({
  items,
  columns,
  getRowHref,
  countLabel,
  isLoading,
  emptyMessage,
  emptyHelpPath,
}: NameUpdatedListProps<T>) {
  const { sort, setSort, toggleSort } = useNameUpdatedListSort();
  const sortLabels = useOverviewSortLabels();
  const sorted = useMemo(() => sortByNameAndUpdated(items, sort), [items, sort]);

  return (
    <div className="space-y-3">
      {/* Always rendered at the button's height, so Reset sorting appearing never moves the table. */}
      <div className="flex h-8 items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {isLoading ? null : countLabel(items.length)}
        </p>
        <ResetSortingButton active={sort.length > 0} onReset={() => setSort([])} />
      </div>
      <OverviewTable
        columns={columns}
        sorting={createOverviewTableSorting(sort, toggleSort, sortLabels)}
        items={sorted}
        isLoading={isLoading}
        getRowKey={(item) => item.id}
        getRowHref={getRowHref}
        emptyMessage={emptyMessage}
        emptyHelpPath={emptyHelpPath}
      />
    </div>
  );
}
