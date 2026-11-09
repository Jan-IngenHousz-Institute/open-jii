"use client";

import { useListDeparture } from "@/components/navigation/list-departure/list-departure";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Searchable lists own q; sort-only lists explicitly leave it alone. */
  searchKey: "q" | null;
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

function buildUrl<S extends ListFilterShape, T extends ListSortItem>(
  options: ListUrlStateOptions<S, T>,
  values: ListUrlValues<S, T>,
  source: URL,
): string {
  const next = new URLSearchParams(source.search);
  for (const [key, value] of toParams(options, values)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString().replace(/%2C/g, ",");
  return `${source.pathname}${query ? `?${query}` : ""}${source.hash}`;
}

/**
 * One writer merges search, filters and sort so concurrent edits cannot undo each other.
 * Replacements preserve unowned parameters and scroll without adding history steps.
 */
export function useListUrlState<S extends ListFilterShape, T extends ListSortItem>(
  config: ListUrlStateOptions<S, T>,
) {
  const { filters, sort, searchKey } = config;
  const options = useMemo(() => ({ filters, sort, searchKey }), [filters, sort, searchKey]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const departure = useListDeparture();
  const [values, setValues] = useState(() => parse(options, searchParams));
  const snapshot = useRef(values);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const intent = useRef<"search" | "immediate" | null>("immediate");
  const emitted = useRef<string[]>([]);
  const observed = useRef<{ pathname: string; serialized: string } | null>(null);
  observed.current ??= { pathname, serialized: serialize(toParams(options, values)) };
  const lastBrowserUrl = useRef<string | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    generation.current += 1;
  }, []);

  const write = useCallback(
    (transport: "router" | "history") => {
      cancel();
      if (!mounted.current || window.location.pathname !== pathname) return;
      const source = new URL(window.location.href);
      const next = buildUrl(options, snapshot.current, source);
      pending.current = false;
      intent.current = null;
      const written = serialize(toParams(options, snapshot.current));
      if (transport === "history") observed.current = { pathname, serialized: written };
      const query = source.searchParams.toString().replace(/%2C/g, ",");
      if (next === `${source.pathname}${query ? `?${query}` : ""}${source.hash}`) return;
      if (transport === "history") {
        window.history.replaceState(null, "", next);
        lastBrowserUrl.current = window.location.href;
      } else {
        emitted.current.push(written);
        router.replace(next, { scroll: false });
      }
    },
    [cancel, options, pathname, router],
  );

  const flush = useCallback(() => {
    if (pending.current) write("history");
  }, [write]);

  useEffect(() => {
    mounted.current = true;
    lastBrowserUrl.current = window.location.href;
    const onHistoryStep = () => {
      const current = new URL(window.location.href);
      const previous = lastBrowserUrl.current ? new URL(lastBrowserUrl.current) : null;
      lastBrowserUrl.current = current.href;
      if (
        previous?.pathname === current.pathname &&
        previous.search === current.search &&
        previous.hash !== current.hash
      )
        return;
      cancel();
      pending.current = false;
      intent.current = null;
      emitted.current = [];
      const restored = parse(options, new URLSearchParams(window.location.search));
      observed.current = {
        pathname: window.location.pathname,
        serialized: serialize(toParams(options, restored)),
      };
      snapshot.current = restored;
      setValues(restored);
    };
    window.addEventListener("popstate", onHistoryStep);
    return () => {
      mounted.current = false;
      cancel();
      pending.current = false;
      intent.current = null;
      emitted.current = [];
      window.removeEventListener("popstate", onHistoryStep);
    };
  }, [cancel, options, pathname]);

  useEffect(() => {
    if (!options.searchKey) return;
    return departure?.register(flush);
  }, [departure, flush, options.searchKey]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- a native flush and same-path push can retain Next's params object; reconcile the live URL after every render.
  useEffect(() => {
    if (window.location.pathname !== pathname) return;
    lastBrowserUrl.current = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const restored = parse(options, params);
    const urlSerialized = serialize(toParams(options, restored));
    const samePath = observed.current?.pathname === pathname;
    if (
      samePath &&
      observed.current?.serialized === urlSerialized &&
      (pending.current ||
        emitted.current.length > 0 ||
        serialize(toParams(options, snapshot.current)) === urlSerialized)
    )
      return;
    observed.current = { pathname, serialized: urlSerialized };
    const echoed = samePath ? emitted.current.indexOf(urlSerialized) : -1;
    if (echoed >= 0) {
      emitted.current = emitted.current.slice(echoed + 1);
      // An acknowledgment never commits a newer draft ahead of its timer.
      if (!pending.current && serialize(toParams(options, snapshot.current)) !== urlSerialized)
        write("router");
      return;
    }
    cancel();
    pending.current = false;
    intent.current = null;
    emitted.current = [];
    snapshot.current = restored;
    setValues(restored);
  });

  useEffect(() => {
    if (intent.current === null) return;
    if (intent.current === "immediate") {
      write("router");
      return;
    }
    cancel();
    const scheduled = generation.current;
    timer.current = setTimeout(() => {
      if (generation.current === scheduled) write("router");
    }, 300);
  }, [cancel, values, write]);

  const update = (next: ListUrlValues<S, T>, immediate: boolean) => {
    snapshot.current = next;
    pending.current = true;
    if (immediate || intent.current !== "immediate")
      intent.current = immediate ? "immediate" : "search";
    setValues(next);
  };
  const setFilter = <K extends keyof S>(key: K, next: z.infer<S[K]>[]) => {
    update(
      { ...snapshot.current, filters: { ...snapshot.current.filters, [key]: [...new Set(next)] } },
      true,
    );
  };
  const clearFilters = () =>
    update(
      {
        ...snapshot.current,
        filters: parse(options, new URLSearchParams()).filters,
      },
      true,
    );
  const setSort = (sort: T[]) => update({ ...snapshot.current, sort }, true);
  const toggleSort = (field: T["field"], multi: boolean) => {
    update(
      { ...snapshot.current, sort: toggleSortItem(snapshot.current.sort, field, multi) },
      true,
    );
  };
  const setSearch = (search: string) => {
    if (!options.searchKey) {
      snapshot.current = { ...snapshot.current, search };
      setValues(snapshot.current);
      return;
    }
    update({ ...snapshot.current, search }, false);
  };

  return {
    filters: values.filters,
    setFilter,
    clearFilters,
    hasActiveFilters: Object.values<string[]>(values.filters).some((picked) => picked.length > 0),
    sort: values.sort,
    setSort,
    toggleSort,
    search: values.search,
    setSearch,
  };
}
