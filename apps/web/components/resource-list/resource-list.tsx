"use client";

import { ListFilterBar } from "@/components/list-filter-bar";
import { ListPagination } from "@/components/list-pagination";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { OverviewTable } from "@/components/overview-table/overview-table";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import type { RowData } from "@tanstack/react-table";

import type { PaginatedList } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";
import type { SearchInputProps } from "@repo/ui/components/search-input";
import { SearchInput } from "@repo/ui/components/search-input";

interface SortItem<F extends string> {
  field: F;
  direction: "asc" | "desc";
}

/** The list state the view reads and drives; `useResourceList` returns it. */
export interface ResourceListModel<Item, F extends string> {
  data: PaginatedList<Item> | undefined;
  isLoading: boolean;
  isPlaceholderData: boolean;
  isSearchPending: boolean;
  error: unknown;
  refetch(this: void): unknown;
  search: string;
  setSearch(this: void, value: string): void;
  debouncedSearch: string;
  page: number;
  setPage(this: void, page: number): void;
  sort: SortItem<F>[];
  /** The server could not load activity, so it cannot sort by it right now. */
  activityUnavailable?: boolean;
  setSort(this: void, sort: SortItem<F>[]): void;
  toggleSort(this: void, field: F, multi: boolean): void;
  hasActiveFilters: boolean;
  clearFilters(this: void): void;
}

interface ResourceListProps<Item extends RowData, F extends string> {
  list: ResourceListModel<Item, F>;
  filters: readonly ListFilter[];
  searchInput: Omit<SearchInputProps, "value" | "onChange" | "isLoading">;
  columns: OverviewTableColumn<Item, F>[];
  getRowKey: (item: Item) => string;
  getRowHref: (item: Item) => string;
  errorMessage: string;
  /** Why the list is empty: filters win over search, search over an empty collection. */
  emptyMessages: { filtered: string; searched: string; empty: string };
  /** Shown only for an empty collection, never for a narrowed one. */
  emptyHelpPath?: string;
}

/**
 * A resource list page body: search, the Filter menu and Reset sorting, the filter chips, the
 * sortable table with its empty and error states, and pagination.
 */
export function ResourceList<Item extends RowData, F extends string>({
  list,
  filters,
  searchInput,
  columns,
  getRowKey,
  getRowHref,
  errorMessage,
  emptyMessages,
  emptyHelpPath,
}: ResourceListProps<Item, F>) {
  const { t } = useTranslation("common");
  const hasSearch = list.debouncedSearch.trim() !== "";
  const emptyMessage = list.hasActiveFilters
    ? emptyMessages.filtered
    : hasSearch
      ? emptyMessages.searched
      : emptyMessages.empty;

  return (
    <div className="space-y-4">
      <ListFilterBar
        search={
          <SearchInput
            {...searchInput}
            value={list.search}
            onChange={list.setSearch}
            isLoading={list.isSearchPending}
          />
        }
        filters={filters}
        onClearFilters={list.clearFilters}
        actions={
          <ResetSortingButton active={list.sort.length > 0} onReset={() => list.setSort([])} />
        }
      />

      <div
        aria-busy={list.isPlaceholderData}
        inert={list.isPlaceholderData}
        className={`space-y-4 transition-opacity ${list.isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={columns}
          sorting={{
            sort: list.sort,
            onToggle: list.toggleSort,
            activityUnavailable: list.activityUnavailable,
          }}
          items={list.data?.items}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          errorMessage={errorMessage}
          retryLabel={t("errors.tryAgain")}
          getRowKey={getRowKey}
          getRowHref={getRowHref}
          emptyMessage={emptyMessage}
          emptyHelpPath={!hasSearch && !list.hasActiveFilters ? emptyHelpPath : undefined}
          emptyAction={
            list.hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={list.clearFilters}>
                {t("common.clearFilters")}
              </Button>
            )
          }
        />

        {list.data && list.data.items.length > 0 && (
          <ListPagination
            page={list.page}
            totalPages={list.data.totalPages}
            onPageChange={list.setPage}
          />
        )}
      </div>
    </div>
  );
}
