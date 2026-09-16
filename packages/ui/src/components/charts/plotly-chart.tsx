"use client";

import type { Layout, Config, PlotData, Data, PlotMarker, ColorScale, Font } from "plotly.js";
import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
import type { PlotParams } from "react-plotly.js";

import { cn } from "../../lib/utils";
import { withBrandedPngExport } from "./png-export";

// Type definitions for better type safety
interface SafeDimensions {
  width?: number;
  height?: number;
}

interface PlotlyErrorEvent {
  message?: string;
}

interface ToImageButtonOptions {
  format?: "png" | "svg" | "jpeg" | "webp";
  width?: number;
  height?: number;
  scale?: number;
  filename?: string;
}

interface SafeConfig extends Partial<Config> {
  toImageButtonOptions?: ToImageButtonOptions;
}

// The WebGL traces the bundle registers; see `plotly-runtime`. Both are
// regl-backed and draw into the graph div's shared gl canvases.
type WebGLTraceType = "scattergl" | "parcoords";

const WEBGL_TRACE_TYPES: readonly WebGLTraceType[] = ["scattergl", "parcoords"];

const isWebGLTrace = (type: string): type is WebGLTraceType =>
  WEBGL_TRACE_TYPES.some((candidate) => candidate === type);

/**
 * What a WebGL trace falls back to when no context is free. Plotly ships no SVG
 * parallel-coordinates trace, so parcoords has no entry and never falls back.
 */
const SVG_TWIN = { scattergl: "scatter" } as const satisfies Partial<
  Record<WebGLTraceType, string>
>;

const hasSvgTwin = (type: string): type is keyof typeof SVG_TWIN => Object.hasOwn(SVG_TWIN, type);

// Redraw a chart slightly before it is scrolled to, so the caught-up layout is
// in place by the time it is on screen.
const OFFSCREEN_MARGIN = "200px";

// Regular trace types
type StandardTraceType = "scatter" | "bar" | "line" | "area" | "pie" | "box" | "violin";

type PlotlyTraceType = WebGLTraceType | StandardTraceType | string;

// Plotly touches `window` on import, so it only loads on the client, and only
// once a chart is actually rendered.
const loadRuntime = () => import("./plotly-runtime");
const Plot = lazy(() => loadRuntime().then((runtime) => ({ default: runtime.Plot })));

/**
 * Starts the Plotly download before any chart has data to draw, so it overlaps
 * the data wait instead of following it. The import is cached, so this only
 * moves the download forward.
 */
export function preloadPlotly(): void {
  void loadRuntime();
}

// h-full, not h-96: Plotly is lazy-loaded, and a fixed 384px fallback inside a
// 40px sparkline slot shoves the layout on first paint.
const PlotLoadingComponent = () => (
  <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center text-sm">
    Loading chart...
  </div>
);

// Hook to detect if we're on the client side
const useIsClient = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
};

export interface PlotlyChartProps extends Omit<PlotParams, "className"> {
  className?: string;
  loading?: boolean;
  error?: string;
}

// Plotly's gl2d builds three canvases per chart but only wires two of them to a
// context: the pick layer is skipped unless a parcoords trace is present, so a
// parcoords chart costs one more than a scattergl one. Past the browser's budget
// the oldest context is dropped, which blanks that chart's data layer, and a
// rebuild allocates before it releases, so one chart's worth of headroom is
// reserved for that overlap.
const CONTEXTS_PER_GL_CHART = 2;
const CONTEXTS_PER_PARCOORDS_CHART = 3;
const BROWSER_CONTEXT_BUDGET = 16;

interface ContextDemand {
  contexts: number;
  /** A chart with no SVG twin draws on WebGL or not at all, so it is never refused. */
  mandatory: boolean;
}

const SCATTERGL_DEMAND: ContextDemand = {
  contexts: CONTEXTS_PER_GL_CHART,
  mandatory: false,
};

const PARCOORDS_DEMAND: ContextDemand = {
  contexts: CONTEXTS_PER_PARCOORDS_CHART,
  mandatory: true,
};

interface PendingChart {
  demand: ContextDemand;
  callback: () => void;
}

// One rebuild attempt after a lost context, then the chart settles on SVG.
// Rebuilding without a limit thrashes: reviving one chart takes the contexts
// that keep another alive, which loses its context in turn.
const MAX_GL_RECOVERIES = 1;

class WebGLContextManager {
  private static instance: WebGLContextManager;
  private activeContexts = new Map<string, number>();
  private pendingCharts = new Map<string, PendingChart>();
  private readonly contextBudget = BROWSER_CONTEXT_BUDGET - CONTEXTS_PER_GL_CHART;

  static getInstance(): WebGLContextManager {
    if (!WebGLContextManager.instance) {
      WebGLContextManager.instance = new WebGLContextManager();
    }
    return WebGLContextManager.instance;
  }

  canCreateContext(): boolean {
    return this.fits(SCATTERGL_DEMAND);
  }

  // Idempotent on `chartId`: a repeat request refreshes the cost and fires the
  // callback without double-counting. A mandatory chart is admitted over budget
  // because refusing it leaves a blank chart rather than an SVG one.
  requestContext(
    chartId: string,
    callback: () => void,
    demand: ContextDemand = SCATTERGL_DEMAND,
  ): boolean {
    if (this.activeContexts.has(chartId) || this.fits(demand) || demand.mandatory) {
      this.activeContexts.set(chartId, demand.contexts);
      callback();
      return true;
    }
    this.pendingCharts.set(chartId, { demand, callback });
    return false;
  }

  // Releasing both clears any pending callback for this chart (avoids the
  // dead-component leak where an unmounted chart's pending callback would
  // later be promoted into `activeContexts` with nothing left to release it)
  // and only promotes waiters when contexts were actually freed.
  releaseContext(chartId: string): void {
    this.pendingCharts.delete(chartId);
    if (!this.activeContexts.delete(chartId)) return;

    this.promotePending();
  }

  getActiveCount(): number {
    return this.activeContexts.size;
  }

  private usedContexts(): number {
    let total = 0;
    for (const contexts of this.activeContexts.values()) {
      total += contexts;
    }
    return total;
  }

  private fits(demand: ContextDemand): boolean {
    return this.usedContexts() + demand.contexts <= this.contextBudget;
  }

  // Freeing a parcoords chart can admit more than one waiter. Stopping at the
  // first that does not fit keeps the queue in order, so a chart wanting three
  // contexts is not starved by a run of cheaper ones behind it.
  private promotePending(): void {
    for (const [chartId, pending] of this.pendingCharts) {
      if (!this.fits(pending.demand)) return;

      this.pendingCharts.delete(chartId);
      this.activeContexts.set(chartId, pending.demand.contexts);
      pending.callback();
    }
  }
}

// Safe dimension validation
const validateDimensions = (layout: Partial<Layout>): SafeDimensions => {
  if (!layout) return {}; // Don't set default dimensions, let Plotly handle responsive sizing

  const result: SafeDimensions = {};

  if (typeof layout.width === "number" && !isNaN(layout.width) && layout.width > 0) {
    result.width = layout.width;
  }

  if (typeof layout.height === "number" && !isNaN(layout.height) && layout.height > 0) {
    result.height = layout.height;
  }

  return result;
};

// Enhanced safe config generation
const createSafeConfig = (config: Partial<Config> = {}): SafeConfig => {
  const baseConfig: SafeConfig = {
    displayModeBar: true, // Enable toolbar for export
    // Plotly's own `responsive` adds a second window resize listener. The
    // container observer below already covers it, catches resizes the window
    // never sees, and skips charts scrolled out of view.
    responsive: false,
    toImageButtonOptions: {
      format: "svg",
      width: 1200, // Much larger default width
      height: 800, // Much larger default height
      scale: 2, // High DPI for crisp exports
      filename: "plotly-chart", // Better default filename
    },
    ...config,
  };

  // Override any existing toImageButtonOptions to ensure our export settings take precedence
  if (config.toImageButtonOptions) {
    baseConfig.toImageButtonOptions = {
      ...baseConfig.toImageButtonOptions,
      ...config.toImageButtonOptions,
      // Always ensure minimum quality export dimensions
      width: Math.max(config.toImageButtonOptions.width || 1200, 1200),
      height: Math.max(config.toImageButtonOptions.height || 800, 800),
    };
  }

  return baseConfig;
};

// Validate and sanitize Plotly data
const validatePlotlyData = (data: Data[] | undefined): PlotData[] => {
  if (!data || !Array.isArray(data)) {
    console.warn("Plotly data is not an array, returning empty array");
    return [];
  }

  return data
    .map((trace, index) => {
      if (!trace || typeof trace !== "object") {
        console.warn(`Trace ${index} is not a valid object, skipping`);
        return null;
      }

      // Cast to any to work with the complex union type of Data
      const traceAny = trace as any;

      // Create a safe trace by ensuring required properties exist
      const safeTrace: PlotData = {
        ...trace,
        // Only set defaults if the property is undefined, not if it's falsy
        type: traceAny.type !== undefined ? traceAny.type : "scatter",
        mode: traceAny.mode !== undefined ? traceAny.mode : "lines",
      } as PlotData;

      // Ensure line object exists and is properly formed for all traces
      if (["scatter", "scattergl"].includes(safeTrace.type || "")) {
        // Always create a line object for scatter plots
        const scatterTrace = safeTrace as any;
        scatterTrace.line = {
          color: scatterTrace.line?.color || scatterTrace.color || undefined,
          width: scatterTrace.line?.width || 2,
          dash: scatterTrace.line?.dash || "solid",
          ...scatterTrace.line,
        };
      }

      // Ensure marker object is properly formed if it exists
      if (safeTrace.marker && typeof safeTrace.marker === "object") {
        const markerTrace = safeTrace as any; // Need any here due to complex Plotly union types
        markerTrace.marker = {
          color: markerTrace.marker.color || markerTrace.color || undefined,
          size: markerTrace.marker.size || 6,
          ...markerTrace.marker,
        };
      }

      // Remove any undefined properties that might cause issues
      Object.keys(safeTrace).forEach((key) => {
        if ((safeTrace as any)[key] === undefined) {
          delete (safeTrace as any)[key];
        }
      });

      return safeTrace;
    })
    .filter(Boolean) as PlotData[]; // Remove null traces
};

/**
 * Base Plotly chart component that handles SSR, loading states, and errors
 * with WebGL context management and dimension validation
 */
export const PlotlyChart = React.forwardRef<HTMLDivElement, PlotlyChartProps>(
  ({ className, loading, error, data, layout, config, ...plotProps }, ref) => {
    const isClient = useIsClient();
    const [isWebGLEnabled, setIsWebGLEnabled] = useState(true);
    const [isContextAvailable, setIsContextAvailable] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [glGeneration, setGlGeneration] = useState(0);
    const glRecoveriesRef = useRef(0);
    const chartIdRef = useRef<string>(`chart-${Math.random().toString(36).slice(2, 11)}`);
    const contextManager = WebGLContextManager.getInstance();

    // react-plotly's own resize handler listens to `window` only, so a
    // container that changes width without the window changing (collapsing the
    // sidebar, dragging a panel) never reaches Plotly and the plot keeps its
    // old pixel width. `Plots.resize` re-measures the container and relayouts
    // in place; a full `Plotly.react` is only for a changed figure.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const graphDivRef = useRef<HTMLElement | null>(null);
    // Without an IntersectionObserver every chart counts as on screen.
    const isOnScreenRef = useRef(true);
    const resizeIsPendingRef = useRef(false);

    const setContainer = React.useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const resize = () => {
        const graphDiv = graphDivRef.current;
        if (!graphDiv) {
          return;
        }
        resizeIsPendingRef.current = false;
        void loadRuntime().then(({ Plotly }) => Plotly.Plots.resize(graphDiv));
      };

      let frame = 0;
      const sizeObserver = new ResizeObserver(() => {
        // Coalesced: a drag emits an entry per frame.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          // A Plotly resize reruns the whole plot pipeline, redrawing every
          // trace, so an unseen chart banks the change for its way back in.
          if (!isOnScreenRef.current) {
            resizeIsPendingRef.current = true;
            return;
          }
          resize();
        });
      });
      sizeObserver.observe(el);

      const screenObserver =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              (entries) => {
                isOnScreenRef.current = entries.some((entry) => entry.isIntersecting);
                if (isOnScreenRef.current && resizeIsPendingRef.current) {
                  resize();
                }
              },
              { rootMargin: OFFSCREEN_MARGIN },
            );
      screenObserver?.observe(el);

      return () => {
        cancelAnimationFrame(frame);
        sizeObserver.disconnect();
        screenObserver?.disconnect();
      };
    }, []);

    const { onInitialized, onPurge, onWebGlContextLost } = plotProps;
    const handleInitialized = React.useCallback<NonNullable<PlotParams["onInitialized"]>>(
      (figure, graphDiv) => {
        graphDivRef.current = graphDiv;
        onInitialized?.(figure, graphDiv);
      },
      [onInitialized],
    );
    const handlePurge = React.useCallback<NonNullable<PlotParams["onPurge"]>>(
      (figure, graphDiv) => {
        graphDivRef.current = null;
        onPurge?.(figure, graphDiv);
      },
      [onPurge],
    );

    // Validate and sanitize data
    const safeData = React.useMemo(() => {
      if (!data) return [];
      return validatePlotlyData(data);
    }, [data]);

    // Stable boolean drives the context-management effect. Memoizing a
    // primitive (vs `useCallback`) means the effect only re-runs when
    // WebGL relevance flips; the previous shape caused release/reacquire
    // churn on every keystroke in the editor.
    const needsWebGL = React.useMemo(() => {
      if (!isWebGLEnabled) {
        return false;
      }
      return safeData.some((trace: PlotData) => isWebGLTrace(trace.type ?? "scatter"));
    }, [safeData, isWebGLEnabled]);

    // A primitive for the same reason as `needsWebGL`. One fact settles the
    // whole demand: parcoords is what wires the pick layer, and it is also the
    // trace with no SVG twin to fall back to.
    const hasParcoords = React.useMemo(
      () => safeData.some((trace: PlotData) => (trace.type ?? "scatter") === "parcoords"),
      [safeData],
    );

    // Behind the context cap, or once WebGL has been given up on, a chart draws
    // its SVG twin rather than waiting.
    const usesWebGL = needsWebGL && isContextAvailable;
    const renderData = React.useMemo(() => {
      if (usesWebGL) {
        return safeData;
      }
      let downgraded = false;
      const traces = safeData.map((trace: PlotData) => {
        const type = trace.type ?? "scatter";
        if (!hasSvgTwin(type)) {
          return trace;
        }
        downgraded = true;
        return { ...trace, type: SVG_TWIN[type] };
      });
      return downgraded ? traces : safeData;
    }, [safeData, usesWebGL]);

    // Past the browser's budget a context is taken away rather than refused,
    // which leaves Plotly drawing into a dead scene: the plot keeps its axes and
    // legend but loses its data. Remounting routes the rebuild through `purge`,
    // which `Plotly.react` on its own would not do.
    const plotKey = needsWebGL ? `gl-${glGeneration}` : "svg";

    useEffect(() => {
      const chartId = chartIdRef.current;

      if (!needsWebGL) {
        setIsContextAvailable(true);
        // Defensive release covers the WebGL→non-WebGL transition; the
        // manager treats this as a no-op when nothing was held.
        contextManager.releaseContext(chartId);
        return;
      }

      let cancelled = false;
      const granted = contextManager.requestContext(
        chartId,
        () => {
          if (!cancelled) setIsContextAvailable(true);
        },
        hasParcoords ? PARCOORDS_DEMAND : SCATTERGL_DEMAND,
      );
      // Queued behind the cap: draw on SVG now rather than hold the chart on a
      // placeholder until some other chart unmounts. The callback still fires
      // if a slot frees up, and the traces switch back to WebGL then.
      if (!granted) {
        setIsContextAvailable(false);
      }

      return () => {
        cancelled = true;
        contextManager.releaseContext(chartId);
      };
    }, [needsWebGL, hasParcoords, contextManager]);

    // `webglcontextlost` is dispatched on the canvas and does not bubble, so a
    // window listener never hears it. Plotly re-emits it on the graph div, which
    // is what react-plotly surfaces here.
    const handleWebGlContextLost = React.useCallback(() => {
      if (glRecoveriesRef.current >= MAX_GL_RECOVERIES) {
        // Rebuilding again would only take the contexts back off another chart.
        setIsWebGLEnabled(false);
      } else {
        glRecoveriesRef.current += 1;
        setGlGeneration((generation) => generation + 1);
      }
      onWebGlContextLost?.();
    }, [onWebGlContextLost]);

    // Validate and prepare layout
    const safeLayout = React.useMemo(() => {
      if (!layout) return { autosize: true };

      // If layout has autosize enabled and no explicit dimensions, respect that
      if (layout.autosize && !layout.width && !layout.height) {
        const { width: _w, height: _h, ...layoutWithoutDimensions } = layout;
        return {
          ...layoutWithoutDimensions,
          autosize: true,
        };
      }

      // Only validate dimensions if autosize is disabled or explicit dimensions are provided
      const { width, height } = validateDimensions(layout);

      const validatedLayout: Partial<Layout> = {
        ...layout,
        width,
        height,
        autosize: false, // Disable autosize when using explicit dimensions
      };

      // Remove any undefined properties from layout
      Object.keys(validatedLayout).forEach((key) => {
        if ((validatedLayout as any)[key] === undefined) {
          delete (validatedLayout as any)[key];
        }
      });

      return validatedLayout;
    }, [layout]);

    // Prepare safe config
    const safeConfig = React.useMemo(() => {
      return withBrandedPngExport(createSafeConfig(config));
    }, [config]);

    // Handle errors
    const displayError = error || localError;
    if (displayError) {
      return (
        <div
          ref={setContainer}
          className={cn(
            "border-destructive/50 bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border",
            className,
          )}
        >
          <div className="text-center">
            <p className="font-medium">Chart Error</p>
            <p className="text-sm opacity-80">{displayError}</p>
            {localError && (
              <button
                onClick={() => {
                  setLocalError(null);
                  setIsWebGLEnabled(false);
                }}
                className="mt-2 text-xs underline"
              >
                Retry with fallback rendering
              </button>
            )}
          </div>
        </div>
      );
    }

    // Handle loading states
    if (loading) {
      return (
        <div
          ref={setContainer}
          className={cn("flex h-full items-center justify-center", className)}
        >
          <div className="text-muted-foreground animate-pulse">Loading chart...</div>
        </div>
      );
    }

    // Show loading for SSR (prevents hydration mismatch)
    if (!isClient) {
      return (
        <div
          ref={setContainer}
          className={cn("flex h-full items-center justify-center", className)}
        >
          <div className="text-muted-foreground animate-pulse">Loading chart...</div>
        </div>
      );
    }

    return (
      <div
        ref={setContainer}
        className={cn("plotly-container relative h-full min-h-0 w-full flex-1", className)}
      >
        <Suspense fallback={<PlotLoadingComponent />}>
          <Plot
            key={plotKey}
            data={renderData}
            layout={safeLayout}
            config={safeConfig}
            {...plotProps}
            style={{
              width: "100%",
              height: "100%",
              ...plotProps.style,
            }}
            onError={(error: PlotlyErrorEvent) => {
              console.error("Plotly chart error:", error);
              setLocalError(`Rendering error: ${error.message || "Unknown error"}`);

              // If it's a WebGL error, try fallback
              if (error.message?.includes("gl-") || error.message?.includes("WebGL")) {
                setIsWebGLEnabled(false);
              }
            }}
            onInitialized={handleInitialized}
            onPurge={handlePurge}
            onWebGlContextLost={handleWebGlContextLost}
          />
        </Suspense>
      </div>
    );
  },
);

PlotlyChart.displayName = "PlotlyChart";

// Export WebGLContextManager for testing
export { WebGLContextManager };
