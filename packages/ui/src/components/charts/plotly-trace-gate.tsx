"use client";

import type { ReactNode } from "react";
import { use } from "react";

import { pendingTraceTypes } from "./plotly-loader";

interface PlotlyTraceGateProps {
  types: readonly string[];
  children: ReactNode;
}

/** Holds a chart back until Plotly has its trace types: an unregistered type draws as scatter. */
export function PlotlyTraceGate({ types, children }: PlotlyTraceGateProps): ReactNode {
  const pending = pendingTraceTypes(types);
  if (pending) {
    use(pending);
  }
  return children;
}
