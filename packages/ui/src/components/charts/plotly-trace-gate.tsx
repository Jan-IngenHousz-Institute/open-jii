"use client";

import type { ReactNode } from "react";

import { readTraceTypes } from "./plotly-loader";

interface PlotlyTraceGateProps {
  types: readonly string[];
  children: ReactNode;
}

/** Holds a chart back until Plotly has its trace types: an unregistered type draws as scatter. */
export function PlotlyTraceGate({ types, children }: PlotlyTraceGateProps): ReactNode {
  readTraceTypes(types);
  return children;
}
