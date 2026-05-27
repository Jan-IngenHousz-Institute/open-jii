"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseUrlStateOptions<T> {
  key: string;
  serialize: (value: T) => string | null;
  parse: (raw: string | null) => T;
  method?: "replace" | "push";
  bidirectional?: boolean;
}

export function useUrlState<T>(options: UseUrlStateOptions<T>): readonly [T, (next: T) => void] {
  const { key, serialize, parse, method = "replace", bidirectional = true } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo<T>(
    () => parse(searchParams.get(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later syncing flows through the effect below.
    [],
  );
  const [value, setValue] = useState<T>(initial);

  const serialized = serialize(value);

  const navigate = useCallback(
    (qs: string) => {
      const target = qs ? `${pathname}?${qs}` : pathname;
      if (method === "push") {
        router.push(target, { scroll: false });
      } else {
        router.replace(target, { scroll: false });
      }
    },
    [pathname, router, method],
  );

  // Ref so the write effect doesn't refire on searchParams identity churn.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Skip the initial write when local already matches the URL.
  const isInitialEffectRef = useRef(true);

  useEffect(() => {
    if (isInitialEffectRef.current) {
      isInitialEffectRef.current = false;
      // null and "" are distinct: null means "no key in URL", "" means "key present with empty value".
      if (searchParamsRef.current.get(key) === serialized) return;
    }
    const next = new URLSearchParams(searchParamsRef.current.toString());
    if (serialized === null) {
      next.delete(key);
    } else {
      next.set(key, serialized);
    }
    navigate(next.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load-bearing signal is `serialized`; depending on searchParams would re-fire on every identity churn.
  }, [serialized, key, navigate]);

  // Back/forward replay.
  const urlRaw = searchParams.get(key);
  useEffect(() => {
    if (!bidirectional) return;
    if (urlRaw === serialized) return;
    setValue(parse(urlRaw));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally drives off URL change only.
  }, [urlRaw, bidirectional]);

  return [value, setValue] as const;
}
