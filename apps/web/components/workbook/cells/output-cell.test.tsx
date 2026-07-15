import { createOutputCell, createProtocolCell } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OutputCellComponent } from "./output-cell";

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
  y?: number[];
}

vi.mock("@repo/ui/components/charts/plotly-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  const { createElement } = await import("react");
  return {
    ...actual,
    PlotlyChart: ({ data }: { data: MockPlotlyTrace[] }) =>
      createElement(
        "div",
        {
          "data-testid": "plotly-chart",
          "data-series": JSON.stringify(data.map((s) => s.name ?? "")),
        },
        data.map((s) =>
          createElement(
            "div",
            { key: s.name ?? "", "data-testid": `series-${s.name ?? ""}` },
            (s.y ?? []).join(","),
          ),
        ),
      ),
  };
});

// jsdom does not implement navigator.clipboard — provide a minimal stub so
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
    expect(screen.getByText("—")).toBeInTheDocument();
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
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
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
        data: { body: { family: "ambyte", code: multispeqProtocolCode() } },
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
        data: { body: { family: "multispeq", code: multispeqProtocolCode() } },
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
        data: { body: { family: "multispeq", code: multispeqProtocolCode() } },
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
        data: { body: { family: "multispeq", code: undefined } },
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
      // available — measurementToTimeseries can't decode. Falls into the
      // error branch.
      useProtocolMock.mockReturnValue({
        data: { body: { family: "multispeq", code: undefined } },
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
        data: { body: { family: "multispeq", code: multispeqProtocolCode() } },
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
      // Pick the inner ProtocolJson object directly — pickProtocolJson should
      // accept it as-is (the code field can be either a 1-element array or
      // the inner dict, depending on how the protocol was saved).
      const inner = multispeqProtocolCode()[0];
      useProtocolMock.mockReturnValue({
        data: { body: { family: "multispeq", code: inner } },
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
        data: { body: { family: "multispeq", code } },
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
        data: { body: { family: "multispeq", code: { protocol_json: inner } } },
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
});
