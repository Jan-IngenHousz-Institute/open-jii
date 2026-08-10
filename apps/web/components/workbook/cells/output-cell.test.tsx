import { normalizeTracePayload } from "@/lib/trace-v3";
import { createOutputCell, createProtocolCell } from "@/test/factories";
import liveAmbitEnvelope from "@/test/fixtures/ambit-trace-v3-live.json";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OutputCellComponent } from "./output-cell";
import { OutputCellTraceTimeseries } from "./output-cell-trace-timeseries";

const useProtocolMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: useProtocolMock,
}));

// Plotly cannot run in jsdom; render stubs that expose the series for assertions.
// Mock factories are hoisted so we use React.createElement (no JSX) to avoid runtime ordering issues.
vi.mock("@repo/ui/components/charts/line-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  const { createElement } = await import("react");
  return {
    ...actual,
    LineChart: ({ data }: { data: { name: string; y: number[] }[] }) =>
      createElement(
        "div",
        {
          "data-testid": "line-chart",
          "data-series": JSON.stringify(data.map((s) => s.name)),
        },
        data.map((s) =>
          createElement("div", { key: s.name, "data-testid": `series-${s.name}` }, s.y.join(",")),
        ),
      ),
  };
});

interface MockPlotlyTrace {
  name?: string;
  mode?: string;
  x?: number[];
  y?: number[];
  line?: { dash?: string };
}

vi.mock("@repo/ui/components/charts/plotly-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  const { createElement } = await import("react");
  const serializePoints = (points: number[]) =>
    JSON.stringify(points.length > 1000 ? [points[0], points.at(-1), points.length] : points);
  return {
    ...actual,
    PlotlyChart: ({
      data,
      layout,
    }: {
      data: MockPlotlyTrace[];
      layout?: {
        xaxis?: { range?: number[] };
        yaxis?: { title?: { text?: string } };
      };
    }) =>
      createElement(
        "div",
        {
          "data-testid": "plotly-chart",
          "data-series": JSON.stringify(data.map((s) => s.name ?? "")),
          "data-x-range": JSON.stringify(layout?.xaxis?.range ?? []),
          "data-yaxis-title": layout?.yaxis?.title?.text ?? "",
        },
        data.map((s) =>
          createElement(
            "div",
            {
              key: s.name ?? "",
              "data-testid": `series-${s.name ?? ""}`,
              "data-x": serializePoints(s.x ?? []),
              "data-line-dash": s.line?.dash ?? "",
              "data-mode": s.mode ?? "",
            },
            (s.y ?? []).length > 1000 ? `${s.y?.length ?? 0} points` : (s.y ?? []).join(","),
          ),
        ),
      ),
  };
});

// jsdom does not implement navigator.clipboard, so provide a minimal stub so
// useCopyToClipboard resolves instead of throwing. Hoisted so tests can
// assert payloads and reset between runs (otherwise call counts leak).
const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText },
  writable: true,
  configurable: true,
});

describe("OutputCellComponent", () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    writeText.mockClear();
    onUpdate.mockClear();
    onDelete.mockClear();
    useProtocolMock.mockReset();
    useProtocolMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("displays execution time and messages with correct severity styling", () => {
    const cell = createOutputCell({
      executionTime: 2500,
      messages: ["Error: sensor failed", "Warning: low battery", "Measurement started"],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("2.50s")).toBeInTheDocument();
    expect(screen.getByText("Error: sensor failed")).toBeInTheDocument();
    expect(screen.getByText("Warning: low battery")).toBeInTheDocument();
    expect(screen.getByText("Measurement started")).toBeInTheDocument();
  });

  describe("multi-device results", () => {
    const deviceResults = [
      { deviceId: "d1", deviceLabel: "Mock MultispeQ 1", data: { device_id: "mock-1", spad: 41 } },
      {
        deviceId: "d2",
        deviceLabel: "Mock MultispeQ 2",
        error: "Mock device failure (simulated)",
      },
      { deviceId: "d3", deviceLabel: "Mock MultispeQ 3", data: { device_id: "mock-3", spad: 44 } },
    ];

    it("renders one block per device with ok/error status", () => {
      const cell = createOutputCell({ data: { device_id: "mock-1" }, deviceResults });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      const blocks = screen.getAllByTestId("device-result");
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toHaveAttribute("data-status", "ok");
      expect(blocks[1]).toHaveAttribute("data-status", "error");
      expect(screen.getByText("Mock MultispeQ 2")).toBeInTheDocument();
      expect(screen.getByText("Mock device failure (simulated)")).toBeInTheDocument();
      // Per-device data renders through the same table view.
      expect(screen.getByText("41")).toBeInTheDocument();
      expect(screen.getByText("44")).toBeInTheDocument();
      // The primary single-device view is suppressed in favour of the blocks.
      expect(screen.getAllByText("device_id")).toHaveLength(2);
    });

    it("keeps per-device tab state independent", async () => {
      const user = userEvent.setup();
      const cell = createOutputCell({ data: { device_id: "mock-1" }, deviceResults });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      const jsonTabs = screen.getAllByRole("tab", { name: "output.tabJson" });
      await user.click(jsonTabs[0]);

      // First device shows raw JSON, third still shows its table.
      expect(screen.getByText(/"spad": 41/)).toBeInTheDocument();
      expect(screen.queryByText(/"spad": 44/)).not.toBeInTheDocument();
      expect(screen.getByText("44")).toBeInTheDocument();
    });

    it("falls back to the label-less device id and counts as content", () => {
      const cell = createOutputCell({
        deviceResults: [{ deviceId: "dev-9", data: { v: 1 } }],
      });
      // A single entry keeps the classic single view (no blocks)...
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
      expect(screen.queryAllByTestId("device-result")).toHaveLength(0);
    });

    it("presents product identity and a stable id for a single-device result", () => {
      const cell = createOutputCell({
        data: { value: 1 },
        deviceResults: [
          {
            deviceId: "connection-1",
            deviceLabel: "MSQ-42",
            family: "multispeq",
            data: { value: 1 },
          },
        ],
      });

      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      expect(screen.getByTestId("single-device-result")).toBeInTheDocument();
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
      expect(screen.getByText("MSQ-42")).toBeInTheDocument();
    });

    it("uses a reported name before product identity in multi-device results", () => {
      const cell = createOutputCell({
        data: { value: 1 },
        deviceResults: [
          {
            deviceId: "connection-1",
            deviceLabel: "AMB-1",
            deviceName: "Canopy sensor",
            family: "ambit",
            data: { value: 1 },
          },
          {
            deviceId: "connection-2",
            deviceLabel: "AMB-2",
            family: "ambit",
            data: { value: 2 },
          },
        ],
      });

      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      expect(screen.getByText("Canopy sensor")).toBeInTheDocument();
      expect(screen.getByText("Ambit · AMB-1")).toBeInTheDocument();
      expect(screen.getByText("Ambit")).toBeInTheDocument();
      expect(screen.getByText("AMB-2")).toBeInTheDocument();
    });
  });

  it("shows question answer data when data has an answer field", () => {
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders table/JSON tabs for measurement data and switches between them", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({
      data: [{ time: 1, value: 42 }],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "output.tabJson" }));
    expect(screen.getByText(/"value": 42/)).toBeInTheDocument();
  });

  it("calls onDelete when the user clicks the clear button", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTitle("output.clear"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("hides the clear button and shows data normally in readOnly mode", () => {
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} readOnly />);

    expect(screen.queryByTitle("output.clear")).not.toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("shows empty state when no data or messages are present", () => {
    const cell = createOutputCell();
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("output.empty")).toBeInTheDocument();
  });

  it("formats short execution times in milliseconds", () => {
    const cell = createOutputCell({ executionTime: 500 });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText("500ms")).toBeInTheDocument();
  });

  it("renders a key/value table for plain object data (typical protocol output)", () => {
    const cell = createOutputCell({
      data: { device_id: "abc-123", firmware_version: "1.2.3", sample_count: 42 },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("device_id")).toBeInTheDocument();
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("firmware_version")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("sample_count")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("toggles collapse state when the chevron is clicked", async () => {
    const user = userEvent.setup();
    const localOnUpdate = vi.fn();
    const cell = createOutputCell({ data: [{ time: 1, value: 42 }] });
    const { rerender } = render(
      <OutputCellComponent cell={cell} onUpdate={localOnUpdate} onDelete={onDelete} />,
    );

    expect(screen.getByText("time")).toBeInTheDocument();

    await user.click(screen.getByTitle("output.collapse"));
    expect(localOnUpdate).toHaveBeenCalledWith({ ...cell, isCollapsed: true });

    rerender(
      <OutputCellComponent
        cell={{ ...cell, isCollapsed: true }}
        onUpdate={localOnUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText("time")).not.toBeInTheDocument();
    expect(screen.getByTitle("output.expand")).toBeInTheDocument();
  });

  it("renders inline sparklines for numeric-array fields in the table", () => {
    const cell = createOutputCell({
      data: { device_id: "abc", spectrum: [10, 20, 30], baseline: [1, 2, 3] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId("sparkline-spectrum")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-baseline")).toBeInTheDocument();
    // Plain string values still render as text, not as charts.
    expect(screen.getByText("abc")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("renders sparklines inside nested rows (MultispeQ-style set[0] payload)", () => {
    const cell = createOutputCell({
      data: { set: [{ ENV: [1, 2, 3], SUN: [10, 20, 30] }], protocol_id: 12 },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId("sparkline-ENV")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-SUN")).toBeInTheDocument();
  });

  it("expands the full chart below the table when a sparkline is clicked, and closes it again", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({
      data: { spectrum: [10, 20, 30], baseline: [1, 2, 3] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("sparkline-spectrum"));
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("series-spectrum")).toHaveTextContent("10,20,30");

    await user.click(screen.getByRole("button", { name: "output.closeChart" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("clicking the same sparkline a second time toggles the expanded chart off", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    const trigger = screen.getByTestId("sparkline-spectrum");
    await user.click(trigger);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("switches the expanded chart to a different column on a single click", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30], baseline: [1, 2, 3] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTestId("sparkline-spectrum"));
    expect(screen.getByTestId("series-spectrum")).toBeInTheDocument();

    await user.click(screen.getByTestId("sparkline-baseline"));
    expect(screen.queryByTestId("series-spectrum")).not.toBeInTheDocument();
    expect(screen.getByTestId("series-baseline")).toHaveTextContent("1,2,3");
  });

  it("collapses the expanded chart when the user switches to the JSON tab", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTestId("sparkline-spectrum"));
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "output.tabJson" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();

    // Switching back to Table doesn't auto-restore the chart; the user re-clicks the sparkline.
    await user.click(screen.getByRole("tab", { name: "output.tabTable" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("does not render a sparkline when no field is a numeric array", () => {
    const cell = createOutputCell({ data: { device_id: "abc-123", firmware_version: "1.2.3" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.queryAllByTestId(/sparkline-/)).toHaveLength(0);
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.getByText("device_id")).toBeInTheDocument();
  });

  it("renders an array of non-numeric primitives as a comma-joined string in a cell", () => {
    const cell = createOutputCell({
      data: { device_id: "abc", tags: ["alpha", "beta", "gamma"] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("alpha, beta, gamma")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/sparkline-/)).toHaveLength(0);
  });

  it("renders a nested plain object inside a cell as a sub-table", () => {
    const cell = createOutputCell({
      data: { device: { id: "esp32-c3", firmware: "1.0.0" } },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("device")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("esp32-c3")).toBeInTheDocument();
    expect(screen.getByText("firmware")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
  });

  it("renders a top-level primitive data value as plain text in the table tab", () => {
    const cell = createOutputCell({ data: "raw measurement string" });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("raw measurement string")).toBeInTheDocument();
  });

  it("renders a top-level array of primitives via JSON in the table tab", () => {
    const cell = createOutputCell({ data: [1, 2, 3] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("[1,2,3]")).toBeInTheDocument();
  });

  it("renders nullish entries in a non-numeric array as empty strings", () => {
    const cell = createOutputCell({ data: { tags: ["a", null, "b"] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("a, , b")).toBeInTheDocument();
  });

  it("falls back to the empty-state message when data is an empty object", () => {
    const cell = createOutputCell({ data: {} });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("output.noData")).toBeInTheDocument();
  });

  it("renders an em-dash placeholder for nullish cell values", () => {
    const cell = createOutputCell({ data: { device_id: "abc", missing: null } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("renders an empty-array placeholder for empty-array cell values", () => {
    const cell = createOutputCell({ data: { device_id: "abc", samples: [] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("samples")).toBeInTheDocument();
    expect(screen.getByText("[]")).toBeInTheDocument();
  });

  it("renders a sparkline for a single-point numeric array (no division by zero)", () => {
    const cell = createOutputCell({ data: { spectrum: [42] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId("sparkline-spectrum")).toBeInTheDocument();
    expect(screen.getByText("n=1")).toBeInTheDocument();
  });

  it("renders a sparkline for a constant-value numeric array (no NaN range)", () => {
    const cell = createOutputCell({ data: { spectrum: [5, 5, 5] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId("sparkline-spectrum")).toBeInTheDocument();
  });

  it("renders multi-row array-of-objects tables with row dividers", () => {
    const cell = createOutputCell({
      data: [
        { time: 1, value: 42 },
        { time: 2, value: 84 },
      ],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });

  it("shows a copy button in the JSON view that swaps to a check icon when clicked", async () => {
    const user = userEvent.setup();
    // userEvent.setup() v14 replaces navigator.clipboard with its own stub; re-install ours
    // so we can assert the payload that was copied.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const cell = createOutputCell({ data: [{ time: 1, value: 42 }] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByRole("tab", { name: "output.tabJson" }));
    const copyButton = screen.getByRole("button", { name: "output.copyJson" });
    expect(copyButton.querySelector(".lucide-copy")).toBeInTheDocument();

    await user.click(copyButton);
    await waitFor(() => {
      expect(copyButton.querySelector(".lucide-check")).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(cell.data, null, 2));
  });

  it("uses local state to collapse in readOnly mode without mutating persisted state", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { device_id: "abc" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} readOnly />);

    expect(screen.getByText("device_id")).toBeInTheDocument();
    await user.click(screen.getByTitle("output.collapse"));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("device_id")).not.toBeInTheDocument();
    expect(screen.getByTitle("output.expand")).toBeInTheDocument();
  });

  it("renders an array of objects with primitive rows without throwing", () => {
    const cell = createOutputCell({
      data: [{ time: 1, value: 42 }, "broken-row", null, { time: 2, value: 84 }],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    // Non-object rows render as em-dash placeholders in every column.
    expect(screen.getAllByText("\u2014").length).toBeGreaterThanOrEqual(4);
  });

  describe("Timeseries tab (multispeq)", () => {
    function multispeqProtocolCode() {
      return [
        {
          v_arrays: [[3]],
          _protocol_set_: [
            {
              label: "ABS",
              pulses: ["@n0:0"],
              pulse_distance: [1000],
              detectors: [[3]],
              pulsed_lights: [[1]],
              nonpulsed_lights: [[2]],
              nonpulsed_lights_brightness: [[100]],
            },
          ],
        },
      ];
    }

    function multispeqOutput() {
      return {
        sample_raw: JSON.stringify([
          { set: [{ label: "ABS", data_raw: [10, 20, 30], pi: [2, 100, 1] }] },
        ]),
      };
    }

    it("does not show the Timeseries tab when there is no source protocol cell", () => {
      const cell = createOutputCell({ data: multispeqOutput() });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
      expect(screen.queryByRole("tab", { name: "output.tabTimeseries" })).not.toBeInTheDocument();
    });

    it("does not show the Timeseries tab when the source protocol family is not multispeq", () => {
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      useProtocolMock.mockReturnValue({
        data: { family: "ambyte", code: multispeqProtocolCode() },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      expect(screen.queryByRole("tab", { name: "output.tabTimeseries" })).not.toBeInTheDocument();
    });

    it("does not show the Timeseries tab when output data is not a multispeq payload", () => {
      const proto = createProtocolCell();
      const cell = createOutputCell({
        data: { device_id: "abc", firmware: "1.0" },
        producedBy: proto.id,
      });
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: multispeqProtocolCode() },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      expect(screen.queryByRole("tab", { name: "output.tabTimeseries" })).not.toBeInTheDocument();
    });

    it("shows a Timeseries tab and decodes detectors into a chart for multispeq output", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: multispeqProtocolCode() },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );

      const tab = screen.getByRole("tab", { name: "output.tabTimeseries" });
      await user.click(tab);

      // Decoded series name follows "<sub_protocol> · <led label> [vmin-vmax]";
      // values are normalised 0..1.
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
      expect(screen.getByTestId("series-ABS · 530 nm (green, body) [10-30]")).toHaveTextContent(
        "0,0.5,1",
      );
    });

    it("shows a loading placeholder while the source protocol is being fetched", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      // Family is multispeq so the tab shows; `isLoading: true` triggers the
      // loading branch in OutputCellTimeseries.
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: undefined },
        isLoading: true,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      expect(screen.getByText("output.loadingProtocol")).toBeInTheDocument();
    });

    it("shows the decode-error placeholder when the protocol code is missing", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      // Family is multispeq, isLoading is false, but no protocol code is
      // available, so measurementToTimeseries can't decode. Falls into the
      // error branch.
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: undefined },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      expect(screen.getByText("output.timeseriesError")).toBeInTheDocument();
    });

    it("shows the empty placeholder when decoding succeeds but emits no detector data", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      // Sample with a sub-protocol whose label has no protocol set entry, so
      // outputs come back empty after decoding.
      const cell = createOutputCell({
        data: {
          sample_raw: JSON.stringify([
            { set: [{ label: "UNKNOWN_PROTOCOL_LABEL", data_raw: [] }] },
          ]),
        },
        producedBy: proto.id,
      });
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: multispeqProtocolCode() },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      expect(screen.getByText("output.timeseriesEmpty")).toBeInTheDocument();
    });

    it("decodes a protocol passed in already-unwrapped (object, not single-element array) form", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      // Pick the inner ProtocolJson object directly, since pickProtocolJson should
      // accept it as-is (the code field can be either a 1-element array or
      // the inner dict, depending on how the protocol was saved).
      const inner = multispeqProtocolCode()[0];
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: inner },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("collapses repeated actinic brightness across phases into a min-max range entry", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      // Protocol with two phases at different actinic brightnesses for the same LED.
      const code = [
        {
          v_arrays: [[3, 3]],
          _protocol_set_: [
            {
              label: "ABS",
              pulses: ["@n0:0", "@n0:1"],
              pulse_distance: [1000, 1000],
              detectors: [[3], [3]],
              pulsed_lights: [[1], [1]],
              nonpulsed_lights: [[2], [2]],
              nonpulsed_lights_brightness: [[100], [500]],
            },
          ],
        },
      ];
      const cell = createOutputCell({
        data: {
          sample_raw: JSON.stringify([
            { set: [{ label: "ABS", data_raw: [10, 20, 30, 40, 50, 60] }] },
          ]),
        },
        producedBy: proto.id,
      });
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      // The light legend collapses 100 + 500 µmol on LED 2 into a single trace
      // whose label carries the brightness range; this exercises the min/max
      // update branches in buildLightLegendTraces.
      const seriesAttr = screen.getByTestId("plotly-chart").getAttribute("data-series") ?? "";
      expect(seriesAttr).toMatch(/100-500 µmol/);
    });

    it("decodes a protocol passed wrapped under a `protocol_json` field", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: multispeqOutput(), producedBy: proto.id });
      // The bundled-protocol shape has the inner dict under .protocol_json;
      // the picker should unwrap it.
      const inner = multispeqProtocolCode()[0];
      useProtocolMock.mockReturnValue({
        data: { family: "multispeq", code: { protocol_json: inner } },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Timeseries tab (self-describing trace v3)", () => {
    it("renders the exact live T3 envelope from real sourceProtocolId/allCells provenance", async () => {
      const user = userEvent.setup();
      const proto = createProtocolCell();
      const cell = createOutputCell({ data: liveAmbitEnvelope, producedBy: proto.id });
      useProtocolMock.mockReturnValue({
        data: { family: "ambit", code: [{ ignored_by_self_describing_trace: true }] },
        isLoading: false,
      });
      render(
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          allCells={[proto, cell]}
        />,
      );

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getByTestId("trace-timeseries")).toBeInTheDocument();
      expect(screen.getByTestId("series-fluo_630_signal")).toHaveAttribute(
        "data-x",
        JSON.stringify([
          0, 0.0854, 0.1708, 0.2562, 0.3416, 0.427, 0.5124, 0.5978, 0.6832, 0.854, 1.0248, 1.1956,
          1.3664, 1.5372, 1.708, 1.8788,
        ]),
      );
      expect(screen.getByTestId("trace-run-1-series-leaf_temp")).toHaveTextContent("Cel");
      expect(useProtocolMock).toHaveBeenCalledWith(proto.payload.protocolId, true);
    });

    it("plots regular, subsampled, explicit, and estimated mixed cadences per series", async () => {
      const user = userEvent.setup();
      const cell = createOutputCell({
        data: {
          schema: "ambit.trace/3",
          time: { start_utc: 1785965160359 },
          series: {
            regular: { u: "count", t0: 0, dt: 0.5, v: [10, 20, 30] },
            subsampled: { u: "count", t0: 0.35, dt: 0.8, v: [40, 50] },
            explicit: { u: "Cel", t: [0, 2.1, 4.8], v: [24.1, 24.2, 24.4] },
            estimated: { u: "Cel", t: [0, 2], t_est: true, v: [25, 25.1] },
          },
        },
      });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getByTestId("series-regular")).toHaveAttribute("data-x", "[0,0.5,1]");
      expect(screen.getByTestId("series-subsampled")).toHaveAttribute("data-x", "[0.35,1.15]");
      expect(screen.getByTestId("series-explicit")).toHaveAttribute("data-x", "[0,2.1,4.8]");
      expect(screen.getByTestId("series-regular")).toHaveAttribute("data-mode", "lines");
      expect(screen.getByTestId("trace-run-1-series-estimated")).toHaveAttribute(
        "data-estimated-time",
        "true",
      );
      expect(screen.getByTestId("series-estimated")).toHaveAttribute("data-line-dash", "dash");
      expect(screen.getByTestId("series-estimated")).toHaveAttribute("data-mode", "lines+markers");
      expect(screen.getByText("output.timeseriesEstimatedTime")).toBeInTheDocument();
      expect(
        screen.getAllByTestId("plotly-chart").map((chart) => chart.dataset.yaxisTitle),
      ).toEqual(["count", "count", "Cel", "Cel"]);
    });

    it("renders every trace after snapshot/error records as separate runs with one shared range", async () => {
      const user = userEvent.setup();
      const cell = createOutputCell({
        data: {
          sample: [
            {
              set: [
                { snapshot: { temperature: 21 } },
                {
                  schema: "ambit.trace/3",
                  time: { duration_ms: 1000 },
                  series: { first: { u: "V", t: [0, 1], v: [1, 2] } },
                },
                { error: "prior run failed" },
                {
                  schema: "ambit.trace/3",
                  time: { duration_ms: 5000 },
                  series: { second: { u: "Cel", t: [0, 3], v: [20, 21] } },
                },
              ],
            },
          ],
        },
      });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getAllByTestId(/^trace-run-\d+$/)).toHaveLength(2);
      expect(screen.getByTestId("trace-run-1-series-first")).toBeInTheDocument();
      expect(screen.getByTestId("trace-run-2-series-second")).toBeInTheDocument();
      expect(screen.getByTestId("series-output.timeseriesTraceRun · first")).toHaveTextContent(
        "1,2",
      );
      expect(screen.getByTestId("series-output.timeseriesTraceRun · second")).toHaveTextContent(
        "20,21",
      );
      expect(screen.getAllByTestId("plotly-chart").map((chart) => chart.dataset.xRange)).toEqual([
        "[-0.05,5.05]",
        "[-0.05,5.05]",
      ]);
    });

    it("renders 7 repeated 40,000-point traces with run-scoped ids and one padded range", () => {
      const pointCount = 40_000;
      const times = Array.from({ length: pointCount }, (_, index) => index / 10);
      const values = Array.from({ length: pointCount }, (_, index) => index % 1000);
      const normalized = normalizeTracePayload({
        sample: [
          {
            set: Array.from({ length: 7 }, () => ({
              schema: "ambit.trace/3",
              time: { duration_ms: 4_000_000 },
              series: { signal: { u: "count", t: times, v: values } },
            })),
          },
        ],
      });
      expect(normalized).not.toBeNull();
      if (!normalized) throw new Error("Expected the repeated trace fixture to normalize");

      render(<OutputCellTraceTimeseries normalized={normalized} emptyLabel="invalid" />);

      expect(
        normalized.traces.reduce(
          (count, run) => count + (run.series[0]?.relativeTimeSeconds.length ?? 0),
          0,
        ),
      ).toBe(280_000);
      expect(screen.getAllByTestId("plotly-chart")).toHaveLength(7);
      for (let run = 1; run <= 7; run += 1) {
        expect(screen.getByTestId(`trace-run-${run}-series-signal`)).toBeInTheDocument();
      }
      expect(screen.getAllByTestId("plotly-chart").map((chart) => chart.dataset.xRange)).toEqual(
        Array.from({ length: 7 }, () => "[-40,4040]"),
      );
    });

    it("uses visible markers and a non-degenerate range for a one-point trace", async () => {
      const user = userEvent.setup();
      const cell = createOutputCell({
        data: {
          schema: "ambit.trace/3",
          time: { duration_ms: 0 },
          series: { leaf_temp: { u: "Cel", t: [0], v: [23.4] } },
        },
      });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getByTestId("series-leaf_temp")).toHaveAttribute("data-mode", "markers");
      expect(screen.getByTestId("trace-run-1-series-leaf_temp")).toBeInTheDocument();
      expect(screen.getByTestId("plotly-chart")).toHaveAttribute("data-x-range", "[-0.01,1.01]");
    });

    it("plots valid malformed subsets and shows localized omission and invalid-series warnings", async () => {
      const user = userEvent.setup();
      const cell = createOutputCell({
        data: {
          schema: "ambit.trace/3",
          series: {
            partial: { u: "count", t: [0, Number.NaN, 2], v: [10, 11, 12, 13] },
            invalid: { u: "V", t0: 0, dt: 0, v: [1, 2] },
          },
        },
      });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getByTestId("series-partial")).toHaveTextContent("10,12");
      expect(screen.getByRole("alert")).toHaveTextContent("output.timeseriesTraceOmittedPoints");
      expect(screen.getByRole("alert")).toHaveTextContent("output.timeseriesTraceInvalidSeries");
    });

    it.each([
      ["dt=0", { u: "V", t0: 0, dt: 0, v: [1] }],
      ["empty", { u: "V", t: [], v: [] }],
      ["non-finite", { u: "V", t: [0], v: [Number.NaN] }],
    ])("labels an entirely invalid trace payload for %s", async (_label, invalid) => {
      const user = userEvent.setup();
      const cell = createOutputCell({
        data: { schema: "ambit.trace/3", series: { invalid } },
      });
      render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

      await user.click(screen.getByRole("tab", { name: "output.tabTimeseries" }));

      expect(screen.getByRole("alert")).toHaveTextContent("output.timeseriesTraceEmpty");
      expect(screen.queryByTestId("plotly-chart")).not.toBeInTheDocument();
    });
  });
});
