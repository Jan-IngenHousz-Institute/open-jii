"use client";

import { useListUrlState } from "@/hooks/useListUrlState";
import type { NameUpdatedSortField } from "@/util/name-updated-sort";
import { sortByNameAndUpdated, zNameUpdatedSort } from "@/util/name-updated-sort";
import { useMemo } from "react";

import type { OverviewTableColumn } from "./overview-table";
import { OverviewTable } from "./overview-table";
import { ResetSortingButton } from "./reset-sorting-button";

const NO_FILTERS = {};

interface NamedAndUpdated {
  id: string;
  name: string;
  updatedAt: string;
}

interface NameUpdatedListProps<T extends NamedAndUpdated> {
  items: T[];
  columns: OverviewTableColumn<T, NameUpdatedSortField>[];
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
  const { sort, setSort, toggleSort } = useListUrlState({
    filters: NO_FILTERS,
    sort: zNameUpdatedSort,
  });
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
        sorting={{ sort, onToggle: toggleSort }}
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
