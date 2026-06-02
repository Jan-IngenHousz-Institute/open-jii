"use client";

import type { Layout, Config, PlotData, Data, PlotMarker, ColorScale, Font } from "plotly.js";
import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
import type { PlotParams } from "react-plotly.js";

import { cn } from "../../lib/utils";

// Type definitions for better type safety
interface SafeDimensions {
  width?: number;
  height?: number;
}

interface WebGLErrorEvent extends Event {
  message?: string;
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

// WebGL trace types that require special handling
type WebGLTraceType = "scatter3d" | "surface" | "mesh3d" | "scattergl" | "scattermapbox";

const WEBGL_TRACE_TYPES: readonly WebGLTraceType[] = [
  "scatter3d",
  "surface",
  "mesh3d",
  "scattergl",
  "scattermapbox",
];

// Regular trace types
type StandardTraceType = "scatter" | "bar" | "line" | "area" | "pie" | "box" | "violin";

type PlotlyTraceType = WebGLTraceType | StandardTraceType | string;

// Lazy load Plotly to avoid SSR issues
const Plot = lazy(() => import("react-plotly.js"));

// Loading component for the lazy-loaded Plot
const PlotLoadingComponent = () => (
  <div className="flex h-96 items-center justify-center">Loading chart...</div>
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

// Browsers cap concurrent WebGL contexts (~8–16 per tab). Stay conservative so
// a dashboard of charts degrades to "queued" instead of crashing the GPU
// process. Charts not in the queue render via SVG immediately.
class WebGLContextManager {
  private static instance: WebGLContextManager;
  private activeContexts = new Set<string>();
  private pendingCharts = new Map<string, () => void>();
  private readonly maxContexts = 8;

  static getInstance(): WebGLContextManager {
    if (!WebGLContextManager.instance) {
      WebGLContextManager.instance = new WebGLContextManager();
    }
    return WebGLContextManager.instance;
  }

  canCreateContext(): boolean {
    return this.activeContexts.size < this.maxContexts;
  }

  // Idempotent: if `chartId` already holds a slot, fire the callback and
  // return true without double-counting against the cap.
  requestContext(chartId: string, callback: () => void): boolean {
    if (this.activeContexts.has(chartId)) {
      callback();
      return true;
    }
    if (this.activeContexts.size < this.maxContexts) {
      this.activeContexts.add(chartId);
      callback();
      return true;
    }
    this.pendingCharts.set(chartId, callback);
    return false;
  }

  // Releasing both clears any pending callback for this chart (avoids the
  // dead-component leak where an unmounted chart's pending callback would
  // later be promoted into `activeContexts` with nothing left to release it)
  // and only promotes the next waiter when a slot was actually freed.
  releaseContext(chartId: string): void {
    this.pendingCharts.delete(chartId);
    if (!this.activeContexts.delete(chartId)) return;

    const nextEntry = this.pendingCharts.entries().next();
    if (nextEntry.done) return;
    const [nextChartId, nextCallback] = nextEntry.value;
    this.pendingCharts.delete(nextChartId);
    this.activeContexts.add(nextChartId);
    nextCallback();
  }

  getActiveCount(): number {
    return this.activeContexts.size;
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
const createSafeConfig = (config: Partial<Config> = {}, useWebGL: boolean): SafeConfig => {
  const baseConfig: SafeConfig = {
    displayModeBar: true, // Enable toolbar for export
    responsive: true,
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

  // Force SVG rendering if WebGL is problematic
  if (!useWebGL) {
    return {
      ...baseConfig,
      toImageButtonOptions: {
        ...baseConfig.toImageButtonOptions,
        format: "svg",
        width: 1200, // Increased from 800
        height: 800, // Increased from 600
        scale: 2,
      },
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
          color: scatterTrace.line?.color || scatterTrace.color || "#1f77b4",
          width: scatterTrace.line?.width || 2,
          dash: scatterTrace.line?.dash || "solid",
          ...scatterTrace.line,
        };
      }

      // Ensure marker object is properly formed if it exists
      if (safeTrace.marker && typeof safeTrace.marker === "object") {
        const markerTrace = safeTrace as any; // Need any here due to complex Plotly union types
        markerTrace.marker = {
          color: markerTrace.marker.color || markerTrace.color || "#1f77b4",
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
    const chartIdRef = useRef<string>(`chart-${Math.random().toString(36).slice(2, 11)}`);
    const contextManager = WebGLContextManager.getInstance();

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
      if (!isWebGLEnabled) return false;
      return safeData.some((trace: PlotData) => {
        const type = (trace.type ?? "scatter") as WebGLTraceType;
        return WEBGL_TRACE_TYPES.includes(type);
      });
    }, [safeData, isWebGLEnabled]);

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
      contextManager.requestContext(chartId, () => {
        if (!cancelled) setIsContextAvailable(true);
      });

      return () => {
        cancelled = true;
        contextManager.releaseContext(chartId);
      };
    }, [needsWebGL, contextManager]);

    // Handle WebGL errors gracefully
    useEffect(() => {
      const handleWebGLError = (event: WebGLErrorEvent) => {
        console.warn("WebGL context lost, falling back to SVG rendering");
        setIsWebGLEnabled(false);
        setLocalError("WebGL context lost, using fallback rendering");
      };

      // Listen for WebGL context loss
      if (typeof window !== "undefined") {
        window.addEventListener("webglcontextlost", handleWebGLError);
        return () => window.removeEventListener("webglcontextlost", handleWebGLError);
      }

      return;
    }, []);

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
      return createSafeConfig(config, isWebGLEnabled && isContextAvailable);
    }, [config, isWebGLEnabled, isContextAvailable]);

    // Handle errors
    const displayError = error || localError;
    if (displayError) {
      return (
        <div
          ref={ref}
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
        <div ref={ref} className={cn("flex h-full items-center justify-center", className)}>
          <div className="text-muted-foreground animate-pulse">Loading chart...</div>
        </div>
      );
    }

    // Show loading for SSR (prevents hydration mismatch)
    if (!isClient) {
      return (
        <div ref={ref} className={cn("flex h-full items-center justify-center", className)}>
          <div className="text-muted-foreground animate-pulse">Loading chart...</div>
        </div>
      );
    }

    // Show waiting state for WebGL charts when context not available
    if (needsWebGL && !isContextAvailable) {
      return (
        <div ref={ref} className={cn("flex h-full items-center justify-center", className)}>
          <div className="text-center">
            <div className="text-muted-foreground animate-pulse">Waiting for GPU resources...</div>
            <div className="text-muted-foreground/60 mt-1 text-xs">
              {contextManager.getActiveCount()}/{8} WebGL contexts active
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("plotly-container relative h-full min-h-0 w-full flex-1", className)}
      >
        <Suspense fallback={<PlotLoadingComponent />}>
          <Plot
            data={safeData}
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
            useResizeHandler={true}
          />
        </Suspense>
      </div>
    );
  },
);

PlotlyChart.displayName = "PlotlyChart";

// Export WebGLContextManager for testing
export { WebGLContextManager };
