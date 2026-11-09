"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";

interface ListDeparture {
  register: (flush: () => void) => () => void;
  flush: () => void;
}

const ListDepartureContext = createContext<ListDeparture | null>(null);

export function ListDepartureProvider({ children }: { children: ReactNode }) {
  const callbacks = useRef(new Set<() => void>());
  const register = useCallback((flush: () => void) => {
    callbacks.current.add(flush);
    return () => {
      callbacks.current.delete(flush);
    };
  }, []);
  const flush = useCallback(() => {
    for (const callback of callbacks.current) callback();
  }, []);
  const value = useMemo(() => ({ register, flush }), [register, flush]);
  return <ListDepartureContext.Provider value={value}>{children}</ListDepartureContext.Provider>;
}

export function useListDeparture() {
  return useContext(ListDepartureContext);
}

export function useDepartureRouter() {
  const router = useRouter();
  const departure = useListDeparture();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        departure?.flush();
        router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        if (new URL(args[0], window.location.href).pathname !== window.location.pathname)
          departure?.flush();
        router.replace(...args);
      },
    }),
    [router, departure],
  );
}

interface NavigationEvent {
  preventDefault: () => void;
}

export function useDepartureNavigation(onNavigate?: (event: NavigationEvent) => void) {
  const departure = useListDeparture();
  return useCallback(
    (event: NavigationEvent) => {
      const navigation = { cancelled: false };
      onNavigate?.({
        preventDefault: () => {
          navigation.cancelled = true;
          event.preventDefault();
        },
      });
      if (!navigation.cancelled) departure?.flush();
    },
    [departure, onNavigate],
  );
}
