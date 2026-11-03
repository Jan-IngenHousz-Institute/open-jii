"use client";

import { zNameUpdatedSort } from "@/util/name-updated-sort";

import { useListUrlState } from "./useListUrlState";

const NO_FILTERS = {};

export function useNameUpdatedListSort() {
  const { sort, setSort, toggleSort } = useListUrlState({
    filters: NO_FILTERS,
    sort: zNameUpdatedSort,
  });
  return { sort, setSort, toggleSort };
}
