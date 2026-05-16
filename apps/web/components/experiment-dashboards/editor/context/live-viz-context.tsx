"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";

/** Lifts the embedded builder's in-flight form values up so canvas widgets can subscribe. */
export interface LiveVizState {
  vizId: string;
  values: ChartFormValues;
}

interface LiveVizContextValue {
  live: LiveVizState | null;
  publish: (next: LiveVizState | null) => void;
}

const LiveVizContext = createContext<LiveVizContextValue>({
  live: null,
  publish: () => {
    /* default no-op; subscribers override */
  },
});

export function LiveVizProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveVizState | null>(null);
  const publish = useCallback((next: LiveVizState | null) => {
    setLive(next);
  }, []);
  const value = useMemo<LiveVizContextValue>(() => ({ live, publish }), [live, publish]);
  return <LiveVizContext.Provider value={value}>{children}</LiveVizContext.Provider>;
}

export function useLiveViz(): LiveVizState | null {
  return useContext(LiveVizContext).live;
}

export function useLiveVizPublisher(): (next: LiveVizState | null) => void {
  return useContext(LiveVizContext).publish;
}
