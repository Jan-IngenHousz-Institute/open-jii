"use client";

import { Component } from "react";
import type { ReactNode } from "react";

interface PlotlyErrorBoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

interface PlotlyErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a chart whose Plotly chunk fails to load (an old chunk after a deploy,
 * a dropped connection) inside its own box instead of the page's error screen.
 */
export class PlotlyErrorBoundary extends Component<
  PlotlyErrorBoundaryProps,
  PlotlyErrorBoundaryState
> {
  state: PlotlyErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PlotlyErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
