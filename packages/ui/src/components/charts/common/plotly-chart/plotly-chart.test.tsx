import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Data, Layout } from "plotly.js";
import * as React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { PlotlyChart, WebGLContextManager } from "./plotly-chart";

// Mock react-plotly.js with configurable behavior
let mockPlotComponent: any;

vi.mock("react-plotly.js", () => ({
  __esModule: true,
  default: (props: any) => mockPlotComponent(props),
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
const mockUtils = {
  detectWebGLSupport: vi.fn().mockReturnValue(true),
  getRenderer: vi.fn().mockReturnValue("webgl"),
  validateDimensions: vi.fn().mockReturnValue({ width: 400, height: 300 }),
  getPlotType: vi.fn().mockReturnValue("scatter"),
  createBaseLayout: vi.fn().mockReturnValue({}),
  create3DLayout: vi.fn().mockReturnValue({}),
  createPlotlyConfig: vi.fn().mockReturnValue({}),
};

vi.mock("../utils", () => mockUtils);

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
                color: "#1f77b4", // Default color
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
    it("detects WebGL requirement for scatter3d charts", () => {
      mockUtils.getPlotType.mockReturnValue("scatter3d");

      const testData: Data[] = [
        {
          type: "scatter3d",
          x: [1, 2, 3],
          y: [1, 2, 3],
          z: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

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

    it("detects WebGL requirement for surface charts", () => {
      const testData: Data[] = [
        {
          type: "surface",
          z: [
            [1, 2],
            [3, 4],
          ],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("detects WebGL requirement for mesh3d charts", () => {
      const testData: Data[] = [
        {
          type: "mesh3d",
          x: [1, 2, 3],
          y: [1, 2, 3],
          z: [1, 2, 3],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("detects WebGL requirement for scattermapbox charts", () => {
      const testData: Data[] = [
        {
          type: "scattermapbox",
          lat: [45.5, 43.4],
          lon: [-73.5, -79.4],
        },
      ];

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("handles WebGL context lost events", () => {
      const testData: Data[] = [{ type: "scatter3d", x: [1, 2], y: [1, 2], z: [1, 2] }];
      const consoleSpy = vi.spyOn(console, "warn");

      render(<PlotlyChart data={testData} layout={{}} />);

      // Simulate WebGL context lost event
      const webglContextLostEvent = new CustomEvent("webglcontextlost");
      window.dispatchEvent(webglContextLostEvent);

      expect(consoleSpy).toHaveBeenCalledWith("WebGL context lost, falling back to SVG rendering");

      consoleSpy.mockRestore();
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

    it("shows WebGL waiting state when context is not available", () => {
      const testData: Data[] = [{ type: "scatter3d", x: [1, 2], y: [1, 2], z: [1, 2] }];

      // Mock WebGLContextManager to simulate no available contexts
      const originalManager = WebGLContextManager.getInstance();
      const mockRequestContext = vi.spyOn(originalManager, "requestContext").mockReturnValue(false);
      const mockGetActiveCount = vi.spyOn(originalManager, "getActiveCount").mockReturnValue(6);

      render(<PlotlyChart data={testData} layout={{}} />);

      expect(screen.getByText("Waiting for GPU resources...")).toBeInTheDocument();
      expect(screen.getByText("6/8 WebGL contexts active")).toBeInTheDocument();

      // Cleanup mocks
      mockRequestContext.mockRestore();
      mockGetActiveCount.mockRestore();
    });
  });
});

describe("WebGLContextManager", () => {
  let manager: WebGLContextManager;

  beforeEach(() => {
    manager = WebGLContextManager.getInstance();
    // Clear any existing state
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

      // Fill up to the limit (8 contexts)
      for (let i = 0; i < 8; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        const result = manager.requestContext(`chart-${i}`, callback);
        expect(result).toBe(true);
        expect(callback).toHaveBeenCalledOnce();
      }

      expect(manager.getActiveCount()).toBe(8);

      // Try to add one more - should be queued
      const queuedCallback = vi.fn();
      const result = manager.requestContext("chart-queued", queuedCallback);

      expect(result).toBe(false);
      expect(queuedCallback).not.toHaveBeenCalled();
      expect(manager.getActiveCount()).toBe(8);
    });

    it("correctly reports when context can be created", () => {
      expect(manager.canCreateContext()).toBe(true);

      // Fill up to the limit
      for (let i = 0; i < 8; i++) {
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
      for (let i = 0; i < 8; i++) {
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
      expect(manager.getActiveCount()).toBe(8); // Still at limit, but different chart
    });

    it("handles release of non-existent context gracefully", () => {
      expect(manager.getActiveCount()).toBe(0);

      // Should not throw or cause issues
      manager.releaseContext("non-existent");
      expect(manager.getActiveCount()).toBe(0);
    });

    it("processes queue in FIFO order", () => {
      // Fill up to the limit
      for (let i = 0; i < 8; i++) {
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
      for (let i = 0; i < 8; i++) {
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
  });
});
