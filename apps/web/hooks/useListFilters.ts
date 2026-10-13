"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

export type ListFilterShape = Record<string, z.ZodEnum<[string, ...string[]]>>;

export type ListFilters<S extends ListFilterShape> = { [K in keyof S]: z.infer<S[K]>[] };

interface ReadableParams {
  get(name: string): string | null;
}

/** Each key holds comma-separated values; unknown values and repeats are dropped. */
function parseFilters<S extends ListFilterShape>(shape: S, params: ReadableParams): ListFilters<S> {
  const entries = Object.entries(shape).map(([key, schema]) => {
    const raw = params.get(key);
    const values = raw ? raw.split(",").filter((value) => schema.safeParse(value).success) : [];
    return [key, [...new Set(values)]];
  });
  return Object.fromEntries(entries) as ListFilters<S>;
}

/** Serialize filter state for comparison, including keys with empty selections. */
function serializeFilters(filters: Record<string, string[]>): string {
  return Object.entries(filters)
    .map(([key, values]) => `${key}=${values.join(",")}`)
    .join("&");
}

/**
 * URL-backed multi-value list filters. Every key of `shape` is one filter, written as
 * `?key=a,b`. All keys go out in a single navigation: one `useUrlState` per filter would
 * build each write from the same stale params, so clearing two at once restored one.
 * URL values outside each enum and duplicates are discarded. Setters deduplicate selections;
 * clearing removes every filter key while preserving other query parameters. URL writes replace
 * browser history without scrolling, and back/forward navigation restores the filters.
 */
export function useListFilters<S extends ListFilterShape>(shape: S) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ListFilters<S>>(() => parseFilters(shape, searchParams));

  const serialized = serializeFilters(filters);
  const urlSerialized = serializeFilters(parseFilters(shape, searchParams));

  // Each run reads this render's params and shape; only a filter change, not params identity
  // churn, should trigger a write.
  useEffect(() => {
    const current = searchParams.toString();
    const next = new URLSearchParams(current);
    for (const key of Object.keys(shape)) {
      const values = filters[key];
      if (values.length) {
        next.set(key, values.join(","));
      } else {
        next.delete(key);
      }
    }
    // URLSearchParams encodes the commas; the raw form is the one people share.
    const qs = next.toString().replace(/%2C/g, ",");
    if (qs === current.replace(/%2C/g, ",")) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `serialized` stands for `filters`.
  }, [serialized, pathname, router]);

  // Back/forward replay.
  useEffect(() => {
    if (urlSerialized === serialized) return;
    setFilters(parseFilters(shape, searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally drives off URL change only.
  }, [urlSerialized]);

  const setFilter = useCallback(<K extends keyof S>(key: K, values: z.infer<S[K]>[]) => {
    setFilters((previous) => ({ ...previous, [key]: [...new Set(values)] }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(parseFilters(shape, new URLSearchParams()));
  }, [shape]);

  const hasActiveFilters = Object.values<string[]>(filters).some((values) => values.length > 0);

  return { filters, setFilter, clearFilters, hasActiveFilters };
}
