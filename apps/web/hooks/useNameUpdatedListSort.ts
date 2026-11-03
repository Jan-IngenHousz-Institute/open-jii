"use client";

import { zNameUpdatedSort } from "@/util/name-updated-sort";

import { useListUrlState } from "./useListUrlState";

const NO_FILTERS = {};

/** A dashboards or charts list's sort by name or update, held in the URL. */
export function useNameUpdatedListSort() {
  const { sort, setSort, toggleSort } = useListUrlState({
    filters: NO_FILTERS,
    sort: zNameUpdatedSort,
  });
  return { sort, setSort, toggleSort };
}
