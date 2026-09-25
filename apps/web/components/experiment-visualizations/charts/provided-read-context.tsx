"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { ChartTruncation } from "./hooks/use-chart-data";

const ProvidedReadTruncationContext = createContext<ChartTruncation | undefined>(undefined);

interface ProvidedChartReadProps {
  truncation: ChartTruncation | undefined;
  children: ReactNode;
}

/** How much of its own read a screen holds when it hands a chart the rows ready-made. */
export function ProvidedChartRead({ truncation, children }: ProvidedChartReadProps) {
  return (
    <ProvidedReadTruncationContext.Provider value={truncation}>
      {children}
    </ProvidedReadTruncationContext.Provider>
  );
}

export function useProvidedReadTruncation(): ChartTruncation | undefined {
  return useContext(ProvidedReadTruncationContext);
}
