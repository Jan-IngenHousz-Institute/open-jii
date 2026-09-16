import "@testing-library/jest-dom";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Config, Data, Layout } from "plotly.js";
import * as React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { PlotlyChart, WebGLContextManager } from "../../charts/plotly-chart";

// Mock the Plotly runtime with configurable behavior
let mockPlotComponent: any;

vi.mock("../../charts/plotly-runtime", () => ({
  Plot: (props: any) => mockPlotComponent(props),
  Plotly: { Plots: { resize: vi.fn() } },
}));

// Mock React.lazy to return our mock component directly
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    lazy: vi.fn((fn) => {
      // Return a component that behaves like our mock
      return (props: any) => mockPlotComponent(props);
    }),
    Suspense: ({ children, fallback }: any) => {
      // For testing, we'll just render children directly or fallback if loading
      return children || fallback;
    },
  };
});

// Mock the utils module
// `vi.hoisted` because `vi.mock` is hoisted above this declaration. The factory
// referencing a plain top-level const only threw once the component actually
// imported this module, which is why it sat latent.
const mockUtils = vi.hoisted(() => ({
  detectWebGLSupport: vi.fn().mockReturnValue(true),
  getRenderer: vi.fn().mockReturnValue("webgl"),
  validateDimensions: vi.fn().mockReturnValue({ width: 400, height: 300 }),
  getPlotType: vi.fn().mockReturnValue("scatter"),
  createBaseLayout: vi.fn().mockReturnValue({}),
  create3DLayout: vi.fn().mockReturnValue({}),
  createPlotlyConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("../../charts/utils", () => mockUtils);

/**
 * `webglcontextlost` fires on the canvas and does not bubble, so a window event
 * proves nothing. Plotly re-emits it on the graph div and react-plotly forwards
 * that as `onWebGlContextLost`, which is the path the chart actually uses.
 */
function loseWebGlContext() {
  const props = mockPlotComponent.mock.lastCall?.[0] as { onWebGlContextLost?: () => void };
  act(() => {
    props.onWebGlContextLost?.();
  });
}

function readRenderedTypes(): (string | undefined)[] {
  const props = mockPlotComponent.mock.lastCall?.[0] as { data: { type?: string }[] };
  return props.data.map((trace) => trace.type);
}

describe("PlotlyChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Default mock component
    mockPlotComponent = vi.fn(({ data, layout, config, onError, loading, error, ...props }) => {
      if (loading) {
        return <div data-testid="chart-loading">Loading...</div>;
      }

      if (error) {
        return <div data-testid="chart-error">{error}</div>;
      }

      return (
        <div
          data-testid="plotly-chart"
          data-data={JSON.stringify(data)}
          data-layout={JSON.stringify(layout)}
          data-config={JSON.stringify(config)}
          {...props}
        />
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders with basic data and layout", () => {
      const testData: Data[] = [
        {
          type: "scatter",
          x: [1, 2, 3, 4],
          y: [10, 11, 12, 13],
          mode: "lines+markers",
        },
      ];

      const testLayout: Partial<Layout> = {
        title: { text: "Test Chart" },
        xaxis: { title: { text: "X Axis" } },
        yaxis: { title: { text: "Y Axis" } },
      };

      render(<PlotlyChart data={testData} layout={testLayout} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              type: "scatter",
              x: [1, 2, 3, 4],
              y: [10, 11, 12, 13],
              mode: "lines+markers",
            }),
          ]),
          layout: expect.objectContaining({
            title: { text: "Test Chart" },
            xaxis: { title: { text: "X Axis" } },
            yaxis: { title: { text: "Y Axis" } },
          }),
        }),
      );
    });

    it("applies custom className", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={{}} className="custom-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-chart");
    });

    it("shows loading state when loading prop is true", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={{}} loading />);

      expect(screen.getByText("Loading chart...")).toBeInTheDocument();
    });

    it("shows error state when error prop provided", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={{}} error="Test error message" />);

      expect(screen.getByText("Chart Error")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });
  });

  describe("Data Validation", () => {
    it("handles null data gracefully", () => {
      render(<PlotlyChart data={null as any} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        }),
      );
    });

    it("handles undefined data gracefully", () => {
      render(<PlotlyChart data={undefined as any} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        }),
      );
    });

    it("handles empty data array", () => {
      render(<PlotlyChart data={[]} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        }),
      );
    });

    it("handles traces with missing properties", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          // missing mode property
        },
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          marker: {
            color: "red",
            size: 10,
          },
        },
      ] as Data[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("handles traces with undefined properties and removes them", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          mode: undefined, // This should be removed
          marker: {
            color: "red",
            size: undefined, // This should be removed
          },
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              type: "scatter",
              x: [1, 2, 3],
              y: [1, 2, 3],
              marker: {
                color: "red",
                // size should be removed
              },
              // mode should be removed
            }),
          ],
        }),
      );
    });

    it("filters out null traces from data array", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
        null, // This should be filtered out
        {
          type: "scatter",
          x: [4, 5, 6],
          y: [4, 5, 6],
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              type: "scatter",
              x: [1, 2, 3],
              y: [1, 2, 3],
            }),
            expect.objectContaining({
              type: "scatter",
              x: [4, 5, 6],
              y: [4, 5, 6],
            }),
          ],
        }),
      );
    });

    it("handles non-array data and logs warning", () => {
      const consoleSpy = vi.spyOn(console, "warn");

      render(<PlotlyChart data={"invalid data" as any} layout={{}} />);

      expect(consoleSpy).toHaveBeenCalledWith("Plotly data is not an array, returning empty array");
      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        }),
      );

      consoleSpy.mockRestore();
    });

    it("handles non-scatter traces without line properties", () => {
      const testData = [
        {
          type: "bar", // Non-scatter type - should not get line properties
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
        {
          type: "pie", // Non-scatter type - should not get line properties
          labels: ["A", "B", "C"],
          values: [1, 2, 3],
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              type: "bar",
              x: [1, 2, 3],
              y: [1, 2, 3],
              // Should not have line properties
            }),
            expect.objectContaining({
              type: "pie",
              labels: ["A", "B", "C"],
              values: [1, 2, 3],
              // Should not have line properties
            }),
          ],
        }),
      );
    });

    it("handles traces without marker objects", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          // No marker property - should not trigger marker processing
        },
        {
          type: "scatter",
          x: [4, 5, 6],
          y: [4, 5, 6],
          marker: null, // null marker - should not trigger marker processing
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              type: "scatter",
              x: [1, 2, 3],
              y: [1, 2, 3],
              // Should have line properties but no marker processing
              line: expect.any(Object),
            }),
            expect.objectContaining({
              type: "scatter",
              x: [4, 5, 6],
              y: [4, 5, 6],
              marker: null,
              // Should have line properties
              line: expect.any(Object),
            }),
          ]),
        }),
      );
    });

    it("handles scatter traces with different line property combinations", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          // No line or color properties - should use defaults
        },
        {
          type: "scattergl",
          x: [4, 5, 6],
          y: [4, 5, 6],
          color: "blue", // Has color but no line - should use color for line
        },
        {
          type: "scatter",
          x: [7, 8, 9],
          y: [7, 8, 9],
          line: {
            color: "red", // Has line with color - should use line color
          },
        },
        {
          type: "scatter",
          x: [10, 11, 12],
          y: [10, 11, 12],
          line: {
            // Line exists but no color - should fallback to trace color or default
          },
          color: "green",
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              type: "scatter",
              line: expect.objectContaining({
                color: undefined, // Left to the layout colorway
                width: 2,
                dash: "solid",
              }),
            }),
            expect.objectContaining({
              type: "scattergl",
              line: expect.objectContaining({
                color: "blue", // From trace color
              }),
            }),
            expect.objectContaining({
              type: "scatter",
              line: expect.objectContaining({
                color: "red", // From line color
              }),
            }),
            expect.objectContaining({
              type: "scatter",
              line: expect.objectContaining({
                color: "green", // From trace color fallback
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe("Layout Validation", () => {
    it("handles null layout", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={null as any} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("handles undefined layout", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={undefined as any} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("respects explicit autosize=true with no dimensions", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const layout = { autosize: true };

      render(<PlotlyChart data={testData} layout={layout} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: expect.objectContaining({ autosize: true }),
        }),
      );
    });

    it("handles invalid dimensions properly", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const layout = {
        width: -100, // invalid
        height: "invalid" as any, // invalid
      };

      render(<PlotlyChart data={testData} layout={layout} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("handles valid dimensions properly", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const layout = {
        width: 800, // valid positive number
        height: 600, // valid positive number
        title: { text: "Test Chart" },
      };

      render(<PlotlyChart data={testData} layout={layout} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: expect.objectContaining({
            width: 800,
            height: 600,
            title: { text: "Test Chart" },
            autosize: false, // Should be false when explicit dimensions are provided
          }),
        }),
      );
    });
  });

  describe("Config Handling", () => {
    it("adds the branded download only in the wrapper and keeps it stable across rerenders", async () => {
      const { createPlotlyConfig } =
        await vi.importActual<typeof import("../../charts/utils")>("../../charts/utils");
      const config = createPlotlyConfig({ downloadFilename: "field-trial" });
      expect(config.modeBarButtonsToAdd ?? []).toEqual([]);
      expect(config.modeBarButtonsToRemove).not.toContain("toImage");
      const data: Data[] = [{ type: "scatter", x: [1, 2], y: [2, 3] }];
      const { rerender } = render(<PlotlyChart data={data} layout={{}} config={config} />);
      const exportedConfig = mockPlotComponent.mock.lastCall[0].config;
      expect(exportedConfig.modeBarButtonsToAdd).toEqual([
        expect.objectContaining({ name: "downloadBrandedPng", click: expect.any(Function) }),
      ]);
      expect(
        exportedConfig.modeBarButtonsToRemove.filter((name: string) => name === "toImage"),
      ).toHaveLength(1);
      expect(exportedConfig.toImageButtonOptions.filename).toBe("field-trial");

      rerender(<PlotlyChart data={data} layout={{ title: { text: "Updated" } }} config={config} />);
      expect(mockPlotComponent.mock.lastCall[0].config.modeBarButtonsToAdd[0]).toBe(
        exportedConfig.modeBarButtonsToAdd[0],
      );
    });

    it.each(["png", "svg", "jpeg", "webp"] as const)(
      "preserves %s export settings on initial render and after WebGL fallback",
      (format) => {
        const options = { format, width: 1800, height: 1000, scale: 3, filename: "field-trial" };
        render(
          <PlotlyChart
            data={[{ type: "scatter", x: [1, 2], y: [2, 3] }]}
            layout={{}}
            config={{ toImageButtonOptions: options }}
          />,
        );

        const expectExportConfig = (config: Partial<Config>) => {
          expect(config.toImageButtonOptions).toEqual(options);
          if (format === "png") {
            expect(config.modeBarButtonsToRemove).toContain("toImage");
            expect(config.modeBarButtonsToAdd).toEqual(
              expect.arrayContaining([expect.objectContaining({ name: "downloadBrandedPng" })]),
            );
          } else {
            expect(config.modeBarButtonsToRemove ?? []).not.toContain("toImage");
            expect(config.modeBarButtonsToAdd ?? []).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ name: "downloadBrandedPng" })]),
            );
          }
        };

        for (const [props] of mockPlotComponent.mock.calls) expectExportConfig(props.config);

        // Past the retry limit the chart settles on SVG. It must keep drawing,
        // not turn into an error box, and keep its export settings.
        loseWebGlContext();
        loseWebGlContext();

        expect(screen.queryByText("Chart Error")).not.toBeInTheDocument();
        expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
        expectExportConfig(mockPlotComponent.mock.lastCall[0].config);
      },
    );

    it("handles custom toImageButtonOptions with minimum dimensions", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const customConfig = {
        toImageButtonOptions: {
          width: 800, // Will be upgraded to 1200
          height: 600, // Will be upgraded to 800
          format: "png" as const,
        },
      };

      render(<PlotlyChart data={testData} layout={{}} config={customConfig} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            toImageButtonOptions: expect.objectContaining({
              width: 1200, // Minimum enforced
              height: 800, // Minimum enforced
              format: "png",
            }),
            modeBarButtonsToRemove: expect.arrayContaining(["toImage"]),
            modeBarButtonsToAdd: expect.arrayContaining([
              expect.objectContaining({ name: "downloadBrandedPng" }),
            ]),
          }),
        }),
      );
    });

    it("handles toImageButtonOptions with falsy width/height values", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const customConfig = {
        toImageButtonOptions: {
          width: 0, // Falsy value - should use 1200 fallback
          height: null as any, // Falsy value - should use 800 fallback
          format: "png" as const,
        },
      };

      render(<PlotlyChart data={testData} layout={{}} config={customConfig} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            toImageButtonOptions: expect.objectContaining({
              width: 1200, // Fallback used
              height: 800, // Fallback used
              format: "png",
            }),
          }),
        }),
      );
    });

    it("handles traces with falsy type and mode values", () => {
      const testData = [
        {
          // No type property - should default to "scatter"
          x: [1, 2, 3],
          y: [1, 2, 3],
          mode: null, // Falsy mode - stays as null, not converted to "lines"
        },
        {
          type: "", // Empty string type - stays as "", not converted to "scatter"
          x: [4, 5, 6],
          y: [4, 5, 6],
          // No mode property - should default to "lines"
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              type: "scatter", // Default fallback for missing type
              mode: null, // Falsy mode stays as null
            }),
            expect.objectContaining({
              type: "", // Empty string type stays as is
              mode: "lines", // Default fallback for missing mode
            }),
          ]),
        }),
      );
    });

    it("handles marker color fallback chain", () => {
      const testData = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
          marker: {
            // No color in marker - should fallback to trace color
            size: 8,
          },
          color: "blue", // Should be used for marker color
        },
        {
          type: "scatter",
          x: [4, 5, 6],
          y: [4, 5, 6],
          marker: {
            color: null, // Falsy marker color stays as null, doesn't fallback
            size: 10,
          },
          // No trace color - marker color stays null
        },
      ] as any[];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              marker: expect.objectContaining({
                color: "blue", // From trace color fallback
                size: 8,
              }),
            }),
            expect.objectContaining({
              marker: expect.objectContaining({
                color: null, // Stays as null, doesn't fallback
                size: 10,
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe("WebGL Context Management", () => {
    it("detects WebGL requirement for scattergl charts", () => {
      mockUtils.getPlotType.mockReturnValue("scattergl");

      const testData: Data[] = [
        {
          type: "scattergl",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    // A dead context leaves Plotly's gl layer blank while the axes and legend
    // keep drawing, so the chart has to notice and rebuild rather than sit there.
    it("rebuilds a WebGL chart when its context is lost, then settles on SVG", () => {
      const testData: Data[] = [{ type: "scattergl", x: [1, 2], y: [1, 2] }];

      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi
        .spyOn(originalManager, "requestContext")
        .mockImplementation((_id, callback) => {
          callback();
          return true;
        });

      render(<PlotlyChart data={testData} layout={{}} />);
      const firstNode = screen.getByTestId("plotly-chart");
      expect(readRenderedTypes()).toEqual(["scattergl"]);

      // First loss: remount, which routes the rebuild through `purge`.
      loseWebGlContext();
      expect(screen.getByTestId("plotly-chart")).not.toBe(firstNode);
      expect(readRenderedTypes()).toEqual(["scattergl"]);

      // Second loss: stop fighting for contexts and draw on SVG.
      loseWebGlContext();
      expect(readRenderedTypes()).toEqual(["scatter"]);
      expect(screen.queryByText("Chart Error")).not.toBeInTheDocument();

      mockRequestContext.mockRestore();
    });

    it("handles WebGL detection with null/undefined data", () => {
      // Test the optional chaining in shouldUseWebGL function
      render(<PlotlyChart data={null as any} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles general Plotly errors and logs them", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      // Create a Plot component that triggers an error
      mockPlotComponent = vi.fn((props) => {
        React.useEffect(() => {
          setTimeout(() => {
            if (props.onError) {
              const error = new Error("Rendering error occurred");
              props.onError(error);
            }
          }, 10);
        }, [props.onError]);

        return <div data-testid="plotly-plot">Plot with error</div>;
      });

      const testData: Data[] = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Plotly chart error:", expect.any(Error));
      });
    });

    it("handles WebGL-specific errors and disables WebGL", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      mockPlotComponent = vi.fn((props) => {
        React.useEffect(() => {
          setTimeout(() => {
            if (props.onError) {
              const error = new Error("WebGL context lost - gl-error occurred");
              props.onError(error);
            }
          }, 10);
        }, [props.onError]);

        return <div data-testid="plotly-plot">WebGL Plot with error</div>;
      });

      const testData: Data[] = [
        {
          type: "scattergl",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Plotly chart error:",
          expect.objectContaining({
            message: expect.stringContaining("gl-"),
          }),
        );
      });
    });

    it("handles errors with 'gl-' prefix correctly", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      mockPlotComponent = vi.fn((props) => {
        React.useEffect(() => {
          setTimeout(() => {
            if (props.onError) {
              const error = new Error("gl-texture allocation failed");
              props.onError(error);
            }
          }, 10);
        }, [props.onError]);

        return <div data-testid="plotly-plot">GL Error Plot</div>;
      });

      const testData: Data[] = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Plotly chart error:",
          expect.objectContaining({
            message: expect.stringContaining("gl-"),
          }),
        );
      });
    });

    it("handles errors with undefined message", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      mockPlotComponent = vi.fn((props) => {
        React.useEffect(() => {
          setTimeout(() => {
            if (props.onError) {
              const error = { name: "CustomError" } as Error;
              props.onError(error);
            }
          }, 10);
        }, [props.onError]);

        return <div data-testid="plotly-plot">Undefined Error Plot</div>;
      });

      const testData: Data[] = [
        {
          type: "scatter",
          x: [1, 2, 3],
          y: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Plotly chart error:", expect.any(Object));
      });
    });
  });

  describe("Style and Props", () => {
    it("applies responsive styles", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(
        <PlotlyChart data={testData} layout={{}} style={{ width: "100%", height: "400px" }} />,
      );

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          style: { width: "100%", height: "400px" },
        }),
      );
    });

    it("merges custom styles with default styles", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];
      const customStyle = { backgroundColor: "red", padding: "10px" };

      render(<PlotlyChart data={testData} layout={{}} style={customStyle} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          style: expect.objectContaining({
            width: "100%",
            height: "100%",
            backgroundColor: "red",
            padding: "10px",
          }),
        }),
      );
    });

    it("forwards additional props to Plot component", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={{}} useResizeHandler={true} onHover={vi.fn()} />);

      expect(mockPlotComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          useResizeHandler: true,
          onHover: expect.any(Function),
        }),
      );
    });

    it("applies custom className to container", () => {
      const testData: Data[] = [{ type: "scatter", x: [1, 2], y: [1, 2] }];

      render(<PlotlyChart data={testData} layout={{}} className="my-custom-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("my-custom-class");
    });

    it("shows retry button when local error occurs and allows retry with fallback", async () => {
      const testData: Data[] = [{ type: "scatter3d", x: [1, 2], y: [1, 2], z: [1, 2] }];

      // Mock Plot to trigger an error
      mockPlotComponent.mockImplementation(({ onError }: { onError: (error: Error) => void }) => {
        // Trigger error after render
        setTimeout(() => {
          onError(new Error("WebGL context lost"));
        }, 0);
        return <div data-testid="mock-plot" />;
      });

      render(<PlotlyChart data={testData} layout={{}} />);

      // Wait for error to be triggered and state to update
      await waitFor(() => {
        expect(screen.getByText("Chart Error")).toBeInTheDocument();
      });

      expect(screen.getByText(/Rendering error: WebGL context lost/)).toBeInTheDocument();

      // Find and click the retry button
      const retryButton = screen.getByText("Retry with fallback rendering");
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);

      // After retry, error should be cleared and component should re-render
      await waitFor(() => {
        expect(screen.queryByText("Chart Error")).not.toBeInTheDocument();
      });
    });

    it("draws on SVG instead of waiting when no WebGL context is free", () => {
      const testData: Data[] = [{ type: "scattergl", x: [1, 2], y: [1, 2] }];

      // Simulate a dashboard that has already spent every context.
      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi.spyOn(originalManager, "requestContext").mockReturnValue(false);

      render(<PlotlyChart data={testData} layout={{}} />);

      // The chart renders rather than parking on a placeholder, and its trace
      // falls back to the SVG twin so nothing needs a context.
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
      expect(screen.queryByText("Waiting for GPU resources...")).not.toBeInTheDocument();
      const rendered = mockPlotComponent.mock.calls.at(-1)?.[0] as { data: Data[] };
      expect(rendered.data[0]?.type).toBe("scatter");

      mockRequestContext.mockRestore();
    });

    // Measured: recolouring in place costs no extra contexts, while remounting
    // every gl chart on a palette flip churns them and makes the browser evict
    // the oldest, which blanks the charts at the top of a dashboard.
    it("recolours a WebGL chart in place rather than remounting it", async () => {
      const originalManager = WebGLContextManager.getInstance();
      vi.spyOn(originalManager, "requestContext").mockImplementation((_id, callback) => {
        callback();
        return true;
      });
      const glData: Data[] = [{ type: "scattergl", x: [1, 2], y: [1, 2] }];
      const gl = render(<PlotlyChart data={glData} layout={{}} />);
      const glNode = screen.getByTestId("plotly-chart");

      // The palette lands as a new `layout`, which Plotly applies in place.
      await act(async () => {
        document.documentElement.classList.toggle("dark");
        await Promise.resolve();
      });
      gl.rerender(<PlotlyChart data={glData} layout={{ colorway: ["#123456"] }} />);
      expect(screen.getByTestId("plotly-chart")).toBe(glNode);
    });

    it("keeps the WebGL trace when a context is granted", () => {
      const testData: Data[] = [{ type: "scattergl", x: [1, 2], y: [1, 2] }];

      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi
        .spyOn(originalManager, "requestContext")
        .mockImplementation((_id, callback) => {
          callback();
          return true;
        });

      render(<PlotlyChart data={testData} layout={{}} />);

      const rendered = mockPlotComponent.mock.calls.at(-1)?.[0] as { data: Data[] };
      expect(rendered.data[0]?.type).toBe("scattergl");

      mockRequestContext.mockRestore();
    });

    // Plotly wires its pick layer only when parcoords is present, and ships no
    // SVG parallel-coordinates trace to fall back to.
    it("asks for a third context for parcoords and only two for scattergl", () => {
      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi
        .spyOn(originalManager, "requestContext")
        .mockImplementation((_id, callback) => {
          callback();
          return true;
        });

      const parcoords = render(<PlotlyChart data={[{ type: "parcoords" }]} layout={{}} />);
      expect(mockRequestContext).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(Function),
        { contexts: 3, mandatory: true },
      );
      parcoords.unmount();

      render(<PlotlyChart data={[{ type: "scattergl", x: [1], y: [1] }]} layout={{}} />);
      expect(mockRequestContext).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(Function),
        { contexts: 2, mandatory: false },
      );

      mockRequestContext.mockRestore();
    });

    it("leaves parcoords on WebGL when no context is free, having no SVG twin", () => {
      const testData: Data[] = [{ type: "parcoords" }];

      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi.spyOn(originalManager, "requestContext").mockReturnValue(false);

      render(<PlotlyChart data={testData} layout={{}} />);

      const rendered = mockPlotComponent.mock.calls.at(-1)?.[0] as { data: Data[] };
      expect(rendered.data[0]?.type).toBe("parcoords");

      mockRequestContext.mockRestore();
    });
  });
});

describe("WebGLContextManager", () => {
  let manager: WebGLContextManager;

  // Read the cap off the manager rather than restating it, so these stay tests
  // of the queueing behaviour when the browser context budget is re-tuned.
  let CAP: number;

  beforeEach(() => {
    manager = WebGLContextManager.getInstance();
    // Clear any existing state
    (manager as any).activeContexts.clear();
    (manager as any).pendingCharts.clear();

    CAP = 0;
    while (manager.canCreateContext()) {
      manager.requestContext(`cap-probe-${CAP}`, () => undefined);
      CAP++;
    }
    (manager as any).activeContexts.clear();
    (manager as any).pendingCharts.clear();
  });

  afterEach(() => {
    (manager as any).activeContexts.clear();
    (manager as any).pendingCharts.clear();
  });

  describe("Singleton Pattern", () => {
    it("returns the same instance when called multiple times", () => {
      const instance1 = WebGLContextManager.getInstance();
      const instance2 = WebGLContextManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("maintains state across getInstance calls", () => {
      const instance1 = WebGLContextManager.getInstance();
      instance1.requestContext("test-chart", () => {});

      const instance2 = WebGLContextManager.getInstance();
      expect(instance2.getActiveCount()).toBe(1);
    });
  });

  describe("Context Allocation", () => {
    it("allows context creation when under the limit", () => {
      const callbackSpy = vi.fn();
      const result = manager.requestContext("chart-1", callbackSpy);

      expect(result).toBe(true);
      expect(callbackSpy).toHaveBeenCalledOnce();
      expect(manager.getActiveCount()).toBe(1);
    });

    it("queues context requests when at the limit", () => {
      const callbacks: any[] = [];

      // Fill up to the limit
      for (let i = 0; i < CAP; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        const result = manager.requestContext(`chart-${i}`, callback);
        expect(result).toBe(true);
        expect(callback).toHaveBeenCalledOnce();
      }

      expect(manager.getActiveCount()).toBe(CAP);

      // Try to add one more - should be queued
      const queuedCallback = vi.fn();
      const result = manager.requestContext("chart-queued", queuedCallback);

      expect(result).toBe(false);
      expect(queuedCallback).not.toHaveBeenCalled();
      expect(manager.getActiveCount()).toBe(CAP);
    });

    it("correctly reports when context can be created", () => {
      expect(manager.canCreateContext()).toBe(true);

      // Fill up to the limit
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }

      expect(manager.canCreateContext()).toBe(false);
    });
  });

  describe("Context Release and Queue Processing", () => {
    it("releases context and decreases active count", () => {
      manager.requestContext("chart-1", () => {});
      expect(manager.getActiveCount()).toBe(1);

      manager.releaseContext("chart-1");
      expect(manager.getActiveCount()).toBe(0);
    });

    it("processes queued charts when context is released", () => {
      // Fill up to the limit
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }

      // Queue a chart
      const queuedCallback = vi.fn();
      manager.requestContext("chart-queued", queuedCallback);
      expect(queuedCallback).not.toHaveBeenCalled();

      // Release one context
      manager.releaseContext("chart-0");

      // Queued chart should now be processed
      expect(queuedCallback).toHaveBeenCalledOnce();
      expect(manager.getActiveCount()).toBe(CAP); // Still at limit, but different chart
    });

    it("handles release of non-existent context gracefully", () => {
      expect(manager.getActiveCount()).toBe(0);

      // Should not throw or cause issues
      manager.releaseContext("non-existent");
      expect(manager.getActiveCount()).toBe(0);
    });

    it("processes queue in FIFO order", () => {
      // Fill up to the limit
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }

      // Queue multiple charts
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      manager.requestContext("chart-queued-1", callback1);
      manager.requestContext("chart-queued-2", callback2);
      manager.requestContext("chart-queued-3", callback3);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Release one context - first queued should be processed
      manager.releaseContext("chart-0");
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Release another - second queued should be processed
      manager.releaseContext("chart-1");
      expect(callback2).toHaveBeenCalledOnce();
      expect(callback3).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles multiple releases of the same context", () => {
      manager.requestContext("chart-1", () => {});
      expect(manager.getActiveCount()).toBe(1);

      manager.releaseContext("chart-1");
      expect(manager.getActiveCount()).toBe(0);

      // Release again - should not cause issues
      manager.releaseContext("chart-1");
      expect(manager.getActiveCount()).toBe(0);
    });

    it("maintains queue integrity when same ID is queued multiple times", () => {
      // Fill up to the limit
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      // Queue same ID twice (Map will override)
      manager.requestContext("chart-queued", callback1);
      manager.requestContext("chart-queued", callback2);

      // Release one context
      manager.releaseContext("chart-0");

      // Only the last callback should be called (Map behavior)
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it("is idempotent: re-requesting an already-active chartId does not double-count", () => {
      const cb = vi.fn();
      const first = manager.requestContext("chart-1", cb);
      const second = manager.requestContext("chart-1", cb);

      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(cb).toHaveBeenCalledTimes(2);
      expect(manager.getActiveCount()).toBe(1);
    });

    it("releasing a non-active chart does not promote pending charts", () => {
      // Fill the cap with active contexts
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }
      const queuedCallback = vi.fn();
      manager.requestContext("chart-queued", queuedCallback);
      expect(queuedCallback).not.toHaveBeenCalled();

      // No-op release: chartId not in active set; should not promote.
      manager.releaseContext("never-acquired");
      expect(queuedCallback).not.toHaveBeenCalled();
      expect(manager.getActiveCount()).toBe(CAP);
    });

    it("releasing while still pending removes the chart from the pending queue", () => {
      // Fill up the cap so the next request gets queued.
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => {});
      }
      const ghostCallback = vi.fn();
      manager.requestContext("chart-ghost", ghostCallback);

      // Component "unmounts" before being promoted.
      manager.releaseContext("chart-ghost");

      // Now a real slot opens up — the next pending entry should run, not the
      // dropped ghost. Since chart-ghost was dropped, no callback fires until
      // we queue another waiter.
      manager.releaseContext("chart-0");
      expect(ghostCallback).not.toHaveBeenCalled();
      expect(manager.getActiveCount()).toBe(CAP - 1);
    });
  });

  // A parcoords chart holds three contexts where a scattergl one holds two, so
  // the budget is spent in contexts rather than counted in charts.
  describe("Weighted Demands", () => {
    const WIDE = { contexts: 3, mandatory: false };

    it("fits fewer three-context charts than two-context ones", () => {
      let admitted = 0;
      while (manager.requestContext(`wide-${admitted}`, () => undefined, WIDE)) {
        admitted++;
      }

      expect(admitted).toBeGreaterThan(0);
      expect(admitted).toBeLessThan(CAP);
    });

    it("admits a mandatory chart over budget, since it cannot draw on SVG", () => {
      for (let i = 0; i < CAP; i++) {
        manager.requestContext(`chart-${i}`, () => undefined);
      }
      expect(manager.canCreateContext()).toBe(false);

      const callback = vi.fn();
      const granted = manager.requestContext("pinned", callback, {
        contexts: 3,
        mandatory: true,
      });

      expect(granted).toBe(true);
      expect(callback).toHaveBeenCalledOnce();
      expect(manager.getActiveCount()).toBe(CAP + 1);
    });
  });
});

describe("PlotlyChart container resizing", () => {
  // This block sits outside `describe("PlotlyChart")`, so it needs its own
  // fixture rather than inheriting one left behind by an earlier block.
  const nativeResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlotComponent = vi.fn(({ data, layout, config, onError, loading, error, ...props }) => (
      <div
        data-testid="plotly-chart"
        data-data={JSON.stringify(data)}
        data-layout={JSON.stringify(layout)}
        {...props}
      />
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.ResizeObserver = nativeResizeObserver;
  });

  it("relayouts the graph in place when its container resizes", async () => {
    let notify: (() => void) | undefined;
    class StubResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = StubResizeObserver;
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(<PlotlyChart data={[]} layout={{}} />);
    const graphDiv = document.createElement("div");
    const plotProps = mockPlotComponent.mock.calls.at(-1)?.[0];
    act(() => {
      plotProps.onInitialized({ data: [], layout: {}, frames: null }, graphDiv);
    });

    notify?.();
    const { Plotly } = await import("../../charts/plotly-runtime");
    await waitFor(() => expect(Plotly.Plots.resize).toHaveBeenCalledWith(graphDiv));

    frame.mockRestore();
    globalThis.ResizeObserver = original;
  });

  it("observes its own container, not just the window", () => {
    // react-plotly's useResizeHandler binds to `window` resize, so collapsing
    // the sidebar left every chart at its previous pixel width.
    const observe = vi.fn();
    const disconnect = vi.fn();

    class StubResizeObserver implements ResizeObserver {
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }

    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = StubResizeObserver;

    const { unmount } = render(<PlotlyChart data={[]} layout={{}} />);
    expect(observe).toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalled();

    globalThis.ResizeObserver = original;
  });

  // A dashboard keeps every chart it has shown mounted, and the grid resizes
  // all of them together. A Plotly resize is a full redraw, so doing it for
  // charts nobody can see is the bulk of the work in a window drag.
  it("defers the redraw while the chart is off screen and runs it once on the way back", async () => {
    let resized: (() => void) | undefined;
    let intersect: ((isIntersecting: boolean) => void) | undefined;

    class StubResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resized = () => callback([], this);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    class StubIntersectionObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = (isIntersecting) => callback([{ isIntersecting }]);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    }

    const originalResize = globalThis.ResizeObserver;
    const originalIntersection = globalThis.IntersectionObserver;
    globalThis.ResizeObserver = StubResizeObserver;
    vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const { Plotly } = await import("../../charts/plotly-runtime");
    vi.mocked(Plotly.Plots.resize).mockClear();

    render(<PlotlyChart data={[]} layout={{}} />);
    const graphDiv = document.createElement("div");
    const plotProps = mockPlotComponent.mock.calls.at(-1)?.[0];
    act(() => {
      plotProps.onInitialized({ data: [], layout: {}, frames: null }, graphDiv);
    });

    // Scrolled away, then the grid resizes it several times.
    act(() => intersect?.(false));
    resized?.();
    resized?.();
    resized?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Plotly.Plots.resize).not.toHaveBeenCalled();

    // Back into view: one redraw, not one per resize it missed.
    act(() => intersect?.(true));
    await waitFor(() => expect(Plotly.Plots.resize).toHaveBeenCalledWith(graphDiv));
    expect(vi.mocked(Plotly.Plots.resize).mock.calls).toHaveLength(1);

    frame.mockRestore();
    globalThis.ResizeObserver = originalResize;
    globalThis.IntersectionObserver = originalIntersection;
    vi.unstubAllGlobals();
  });
});
