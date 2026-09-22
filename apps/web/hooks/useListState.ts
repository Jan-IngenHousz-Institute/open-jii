"use client";

import { z } from "zod";

import { useUrlState } from "./useUrlState";

type SortItem = { field: string; direction: "asc" | "desc" };

/** URL-backed, ordered server sort. The caller supplies its resource allowlist schema. */
export function useListState<T extends SortItem>(schema: z.ZodType<T[]>) {
  const [sort, setSort] = useUrlState<T[]>({
    key: "sort",
    serialize: (value) => (value.length ? JSON.stringify(value) : null),
    parse: (raw) => {
      if (!raw) return [];
      try {
        const parsed = schema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : [];
      } catch {
        return [];
      }
    },
  });

  const toggleSort = (field: T["field"], multi: boolean) => {
    const current = sort.find((item) => item.field === field);
    const next =
      current?.direction === "asc" ? "desc" : current?.direction === "desc" ? null : "asc";
    if (!multi) {
      setSort(next ? [{ field, direction: next } as T] : []);
      return;
    }
    if (current) {
      setSort(
        next
          ? sort.map((item) => (item.field === field ? ({ field, direction: next } as T) : item))
          : sort.filter((item) => item.field !== field),
      );
      return;
    }
    const other = sort.filter((item) => item.field !== field);
    setSort(next ? [...other.slice(-1), { field, direction: next } as T] : other);
  };

  return { sort, setSort, toggleSort };
}
