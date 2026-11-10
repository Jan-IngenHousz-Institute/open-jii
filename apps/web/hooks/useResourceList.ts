"use client";

import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { z } from "zod";

import type { ListResponse, PaginatedList } from "@repo/api/shared/listing";
import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "./useDebounce";
import type { ListFilters, ListFilterShape, ListSortItem } from "./useListUrlState";
import { useListUrlState } from "./useListUrlState";
import { useSearchPending } from "./useSearchPending";

/** What a list asks its query for. */
export interface ResourceListView<S extends ListFilterShape, T extends ListSortItem> {
  /** The debounced term, untrimmed; the query decides what blank means. */
  search: string;
  page: number;
  sort: T[];
  filters: ListFilters<S>;
}

/** The data a query's options produce: what `select` returns, else what `queryFn` resolves to. */
type QueryData<Q> = Q extends { select: (data: never) => infer Selected }
  ? Selected
  : Q extends { queryFn?: infer Fn }
    ? Fn extends (...args: never[]) => infer Result
      ? Awaited<Result>
      : never
    : never;

/** What a query's `queryFn` resolves to, before any `select`. */
type QueryFnData<Q> = Q extends { queryFn?: infer Fn }
  ? Fn extends (...args: never[]) => infer Result
    ? Awaited<Result>
    : never
  : never;

/** Rejects query options whose result, after any `select`, is not a list response. */
type MustAnswerWithAList<Q> =
  QueryData<Q> extends ListResponse<unknown>
    ? unknown
    : { "the query must answer with a list response": never };

/** The row type of a list response, paged or not. */
type ListItem<TData> = TData extends (infer Item)[]
  ? Item
  : TData extends PaginatedList<infer Item>
    ? Item
    : never;

interface ResourceListOptions<
  S extends ListFilterShape,
  T extends ListSortItem,
  Q extends { queryKey: QueryKey },
> {
  filters: S;
  sort: z.ZodType<T[]>;
  /** Searchable lists own q; sort-only lists explicitly leave it alone. */
  searchKey: "q" | null;
  /**
   * The request for one view, answering with a list response. A paginated response is shown
   * as it comes; an unpaged one is paged here, 20 rows at a time. Its options override the
   * default of keeping the previous rows on screen while the next ones load.
   */
  query: (view: ResourceListView<S, T>) => Q & MustAnswerWithAList<Q>;
}

const CLIENT_PAGE_SIZE = 20;

function pageRows<Item>(rows: Item[], page: number): PaginatedList<Item> {
  const totalPages = Math.max(1, Math.ceil(rows.length / CLIENT_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  return {
    items: rows.slice((current - 1) * CLIENT_PAGE_SIZE, current * CLIENT_PAGE_SIZE),
    page: current,
    pageSize: CLIENT_PAGE_SIZE,
    totalPages,
    totalCount: rows.length,
  };
}

/**
 * One resource list's state and rows: filters, sort and optional search in the URL, a 300 ms
 * search debounce, and a page that returns to 1 whenever search, filters or sort change and
 * snaps back into range when a real response has fewer pages.
 */
export function useResourceList<
  S extends ListFilterShape,
  T extends ListSortItem,
  Q extends { queryKey: QueryKey },
>(options: ResourceListOptions<S, T, Q>) {
  type Item = ListItem<QueryData<Q>>;

  const url = useListUrlState({
    filters: options.filters,
    sort: options.sort,
    searchKey: options.searchKey,
  });
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebounce(url.search, 300);

  const queryOptions: UseQueryOptions<
    QueryFnData<Q>,
    Error,
    ListResponse<Item>,
    QueryKey
  > = options.query({ search: debouncedSearch, page, sort: url.sort, filters: url.filters });
  const query = useQuery({ placeholderData: keepPreviousData, ...queryOptions });

  const data: PaginatedList<Item> | undefined =
    query.data === undefined
      ? undefined
      : isPaginatedList(query.data)
        ? query.data
        : pageRows(query.data, page);

  const isSearchPending = useSearchPending({
    search: url.search,
    debouncedSearch,
    isFetching: query.isFetching,
  });

  // A mutation or background update can shrink the result set under the current
  // page; snap back into range once a real (non-placeholder) response says so.
  if (data && !query.isPlaceholderData && page > Math.max(1, data.totalPages)) {
    setPage(Math.max(1, data.totalPages));
  }

  return {
    data,
    isLoading: query.isPending,
    isPlaceholderData: query.isPlaceholderData,
    isSearchPending,
    error: query.error,
    refetch: query.refetch,
    search: url.search,
    debouncedSearch,
    setSearch: (value: string) => {
      url.setSearch(value);
      setPage(1);
    },
    page,
    setPage,
    sort: url.sort,
    setSort: (next: T[]) => {
      url.setSort(next);
      setPage(1);
    },
    toggleSort: (field: T["field"], multi: boolean) => {
      url.toggleSort(field, multi);
      setPage(1);
    },
    filterShape: options.filters,
    filters: url.filters,
    setFilter: <K extends keyof S>(key: K, values: z.infer<S[K]>[]) => {
      url.setFilter(key, values);
      setPage(1);
    },
    clearFilters: () => {
      url.clearFilters();
      setPage(1);
    },
    hasActiveFilters: url.hasActiveFilters,
  };
}
