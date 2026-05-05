import { createMarkdownCell, createMacroCell, createProtocolCell } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { WorkbookSaveProvider } from "../workbook-overview/workbook-save-context";
import { WorkbookHeader } from "./workbook-header";

const protocolCell = createProtocolCell({
  id: "p1",
  payload: { protocolId: "proto-1", version: 1, name: "Test Protocol" },
});
const macroCell = createMacroCell({
  id: "m1",
  payload: { macroId: "macro-1", language: "python", name: "Test Macro" },
});
const markdownCell = createMarkdownCell({ id: "md1", content: "# Hello" });

function renderHeader(overrides: Partial<Parameters<typeof WorkbookHeader>[0]> = {}) {
  const defaultProps = {
    title: "Test Workbook",
    cells: [markdownCell, protocolCell, macroCell],
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    deviceInfo: null,
    sensorFamily: "multispeq" as const,
    onSensorFamilyChange: vi.fn(),
    connectionType: "serial" as const,
    onConnectionTypeChange: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    isRunningAll: false,
    onRunAll: vi.fn(),
    onStopExecution: vi.fn(),
    onClearOutputs: vi.fn(),
    onToggleFlowchart: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <WorkbookSaveProvider>
        <WorkbookHeader {...defaultProps} />
      </WorkbookSaveProvider>,
    ),
    props: defaultProps,
  };
}

describe("WorkbookHeader", () => {
  it("calls onConnect when user clicks the Connect button", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const connectButton = screen.getByRole("button", { name: /connect/i });
    await user.click(connectButton);

    expect(props.onConnect).toHaveBeenCalledOnce();
  });

  it("calls onDisconnect when connected and user clicks Disconnect", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "MultispeQ v2" },
    });

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    expect(props.onDisconnect).toHaveBeenCalledOnce();
  });

  it("shows 'Disconnected' status when not connected", () => {
    renderHeader();
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows device name when connected", () => {
    renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "MultispeQ v2" },
    });
    expect(screen.getByText("MultispeQ v2")).toBeInTheDocument();
  });

  it("shows 'Connecting...' while connecting", () => {
    renderHeader({ isConnecting: true });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("calls onRunAll when user clicks Run all", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const runAllButton = screen.getByRole("button", { name: /run all/i });
    await user.click(runAllButton);

    expect(props.onRunAll).toHaveBeenCalledOnce();
  });

  it("disables Run all when there are no cells", () => {
    renderHeader({ cells: [] });

    const runAllButton = screen.getByRole("button", { name: /run all/i });
    expect(runAllButton).toBeDisabled();
  });

  it("shows Stop button instead of Run all when running", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isRunningAll: true });

    expect(screen.queryByRole("button", { name: /run all/i })).not.toBeInTheDocument();
    const stopButton = screen.getByRole("button", { name: /stop/i });
    await user.click(stopButton);

    expect(props.onStopExecution).toHaveBeenCalledOnce();
  });

  it("calls onClearOutputs when user clicks Clear all", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const clearButton = screen.getByRole("button", { name: /clear all/i });
    await user.click(clearButton);

    expect(props.onClearOutputs).toHaveBeenCalledOnce();
  });

  it("calls onToggleFlowchart when user clicks Flow button", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const flowButton = screen.getByRole("button", { name: /flow/i });
    await user.click(flowButton);

    expect(props.onToggleFlowchart).toHaveBeenCalledOnce();
  });

  it("shows firmware version when connected with device info", () => {
    renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "Device", device_version: "3.0.1" },
    });
    expect(screen.getByText("FW 3.0.1")).toBeInTheDocument();
  });

  it("displays connection error when present", () => {
    renderHeader({ connectionError: "USB not found" });
    expect(screen.getByText("USB not found")).toBeInTheDocument();
  });
});

/** Captures what gets fed to `new Blob(...)` (the export utility wraps the
 *  exported JSON in a Blob, then triggers an anchor download). The Blob in
 *  jsdom doesn't expose .text() / .arrayBuffer(), so we record the parts
 *  passed at construction time and read them back here. */
const blobParts: string[] = [];
const OriginalBlob = globalThis.Blob;
class CapturingBlob extends OriginalBlob {
  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    super(parts, options);
    blobParts.push(parts.map((p) => (typeof p === "string" ? p : "")).join(""));
  }
}

async function readDownload(
  anchorClick: ReturnType<typeof vi.spyOn>,
): Promise<{ filename: string; payload: unknown }> {
  await waitFor(() => expect(anchorClick).toHaveBeenCalled());
  const lastCall = anchorClick.mock.contexts.at(-1) as HTMLAnchorElement | undefined;
  const filename = lastCall?.download ?? "";
  const text = blobParts.at(-1) ?? "";
  return { filename, payload: JSON.parse(text) as unknown };
}

describe("WorkbookHeader — export menu", () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>;
  let revokeObjectURL: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    globalThis.Blob = CapturingBlob as unknown as typeof Blob;
    blobParts.length = 0;
  });

  afterEach(() => {
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    anchorClick.mockRestore();
    globalThis.Blob = OriginalBlob;
  });

  it("exports the full workbook as JSON when 'Export as JSON' is clicked", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export as json/i }));

    const { filename, payload } = await readDownload(anchorClick);
    expect(filename).toBe("test-workbook.jii.json");
    expect(payload).toMatchObject({
      metadata: { title: "Test Workbook", version: "1.0.0", device_family: "multispeq" },
      cells: expect.any(Array) as unknown,
    });
  });

  it("exports a single protocol reference when only one protocol cell is present", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export protocol only/i }));

    const { filename, payload } = await readDownload(anchorClick);
    expect(filename).toBe("test-workbook-protocol.json");
    // Single protocol → object form, not array.
    expect(payload).toEqual({ ref: "proto-1", version: 1 });
  });

  it("exports a list of protocol references when multiple protocol cells are present", async () => {
    const user = userEvent.setup();
    renderHeader({
      cells: [
        protocolCell,
        createProtocolCell({
          id: "p2",
          payload: { protocolId: "proto-2", version: 2, name: "Other" },
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export protocol only/i }));

    const { payload } = await readDownload(anchorClick);
    expect(payload).toEqual([
      { ref: "proto-1", version: 1 },
      { ref: "proto-2", version: 2 },
    ]);
  });

  it("exports macro references when 'Export Macro Only' is clicked", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export macro only/i }));

    const { filename, payload } = await readDownload(anchorClick);
    expect(filename).toBe("test-workbook-macros.json");
    expect(payload).toEqual([{ macroId: "macro-1", name: "Test Macro", language: "python" }]);
  });

  it("downloads the full workbook as a .jii file via 'Download Workbook'", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /download workbook/i }));

    const { filename, payload } = await readDownload(anchorClick);
    expect(filename).toBe("test-workbook.jii");
    expect(payload).toMatchObject({
      metadata: { title: "Test Workbook", version: "1.0.0" },
      cells: expect.any(Array) as unknown,
    });
  });

  it("disables 'Export Protocol Only' when the workbook has no protocol cells", async () => {
    const user = userEvent.setup();
    renderHeader({ cells: [markdownCell, macroCell] });

    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("menuitem", { name: /export protocol only/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables 'Export Macro Only' when the workbook has no macro cells", async () => {
    const user = userEvent.setup();
    renderHeader({ cells: [markdownCell, protocolCell] });

    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("menuitem", { name: /export macro only/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
