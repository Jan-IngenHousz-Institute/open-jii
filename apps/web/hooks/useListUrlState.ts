"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";

export type ListFilterShape = Record<string, z.ZodEnum<Readonly<Record<string, string>>>>;

export type ListFilters<S extends ListFilterShape> = { [K in keyof S]: z.infer<S[K]>[] };

export interface ListSortItem {
  field: string;
  direction: "asc" | "desc";
}

export interface ListUrlStateOptions<S extends ListFilterShape, T extends ListSortItem> {
  /** Each key is one filter, written as `?key=a,b`. */
  filters: S;
  /** The resource's sort allowlist, written as `?sort=<json>`. */
  sort: z.ZodType<T[]>;
  /** Writes search to the URL under this key; without it, search stays in memory. */
  searchKey?: string;
}

interface ListUrlValues<S extends ListFilterShape, T extends ListSortItem> {
  filters: ListFilters<S>;
  sort: T[];
  search: string;
}

interface ReadableParams {
  get(name: string): string | null;
}

const SORT_KEY = "sort";

function parseSort<T extends ListSortItem>(schema: z.ZodType<T[]>, raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Unknown filter values and repeats are dropped. */
function parse<S extends ListFilterShape, T extends ListSortItem>(
  options: ListUrlStateOptions<S, T>,
  params: ReadableParams,
): ListUrlValues<S, T> {
  const filters = Object.fromEntries(
    Object.entries(options.filters).map(([key, schema]) => {
      const raw = params.get(key);
      const values = raw ? raw.split(",").filter((value) => schema.safeParse(value).success) : [];
      return [key, [...new Set(values)]];
    }),
  ) as ListFilters<S>;
  return {
    filters,
    sort: parseSort(options.sort, params.get(SORT_KEY)),
    search: options.searchKey ? (params.get(options.searchKey) ?? "") : "",
  };
}

/** The owned params as `[key, value | null]`; null removes the key. */
function toParams<S extends ListFilterShape, T extends ListSortItem>(
  options: ListUrlStateOptions<S, T>,
  values: ListUrlValues<S, T>,
): [string, string | null][] {
  const entries: [string, string | null][] = Object.keys(options.filters).map((key) => {
    const picked: string[] = values.filters[key];
    return [key, picked.length ? picked.join(",") : null];
  });
  entries.push([SORT_KEY, values.sort.length ? JSON.stringify(values.sort) : null]);
  if (options.searchKey) {
    entries.push([options.searchKey, values.search === "" ? null : values.search]);
  }
  return entries;
}

function serialize(entries: [string, string | null][]): string {
  return entries.map(([key, value]) => `${key}=${value ?? ""}`).join("&");
}

/** Cycles a field asc → desc → off; `multi` keeps at most one other field. */
function toggleSortItem<T extends ListSortItem>(sort: T[], field: T["field"], multi: boolean): T[] {
  const current = sort.find((item) => item.field === field);
  const next = current?.direction === "asc" ? "desc" : current?.direction === "desc" ? null : "asc";
  if (!multi) {
    return next ? [{ field, direction: next } as T] : [];
  }
  if (current) {
    return next
      ? sort.map((item) => (item.field === field ? ({ field, direction: next } as T) : item))
      : sort.filter((item) => item.field !== field);
  }
  const other = sort.filter((item) => item.field !== field);
  return next ? [...other.slice(-1), { field, direction: next } as T] : other;
}

/**
 * A list's filters, sort and optional search, held together and written to the URL in one
 * navigation. Separate writers each built their URL from the same stale params, so one change
 * could undo another. Writes replace history without scrolling and keep params the list does
 * not own; back and forward restore the state.
 */
export function useListUrlState<S extends ListFilterShape, T extends ListSortItem>(
  options: ListUrlStateOptions<S, T>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [values, setValues] = useState<ListUrlValues<S, T>>(() => parse(options, searchParams));

  const serialized = serialize(toParams(options, values));
  const urlSerialized = serialize(toParams(options, parse(options, searchParams)));
  // Writes the URL has not echoed yet; one arriving late is not a back/forward step.
  const pendingWrites = useRef(new Set<string>());

  // Each run reads this render's params; only a change of the list's own state should write.
  useEffect(() => {
    const current = searchParams.toString();
    const next = new URLSearchParams(current);
    for (const [key, value] of toParams(options, values)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    // URLSearchParams encodes the commas; the raw form is the one people share.
    const qs = next.toString().replace(/%2C/g, ",");
    if (qs === current.replace(/%2C/g, ",")) return;
    pendingWrites.current.add(serialized);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `serialized` stands for `values`.
  }, [serialized, pathname, router]);

  // Back/forward replay.
  useEffect(() => {
    if (urlSerialized === serialized) {
      pendingWrites.current.clear();
      return;
    }
    if (pendingWrites.current.has(urlSerialized)) return;
    setValues(parse(options, searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally drives off URL change only.
  }, [urlSerialized]);

  const setFilter = useCallback(<K extends keyof S>(key: K, next: z.infer<S[K]>[]) => {
    setValues((previous) => ({
      ...previous,
      filters: { ...previous.filters, [key]: [...new Set(next)] },
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setValues((previous) => ({
      ...previous,
      filters: parse(options, new URLSearchParams()).filters,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the shape is a module constant.
  }, []);

  const setSort = useCallback((sort: T[]) => {
    setValues((previous) => ({ ...previous, sort }));
  }, []);

  const toggleSort = useCallback((field: T["field"], multi: boolean) => {
    setValues((previous) => ({ ...previous, sort: toggleSortItem(previous.sort, field, multi) }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setValues((previous) => ({ ...previous, search }));
  }, []);

  const hasActiveFilters = Object.values<string[]>(values.filters).some(
    (picked) => picked.length > 0,
  );

  return {
    filters: values.filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    sort: values.sort,
    setSort,
    toggleSort,
    search: values.search,
    setSearch,
  };
}
