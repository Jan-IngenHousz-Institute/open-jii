import {
  createMacro,
  createMarkdownCell,
  createMacroCell,
  createOutputCell,
  createProtocol,
  createProtocolCell,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";

import { contract } from "@repo/api/contract";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { WorkbookHeader } from "./workbook-header";

vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => ({
    bluetooth: true,
    serial: true,
    any: true,
    bluetoothReason: null,
    serialReason: null,
  }),
}));

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
      <AutosaveStatusProvider>
        <WorkbookHeader {...defaultProps} />
      </AutosaveStatusProvider>,
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
    const outputCell = createOutputCell({ producedBy: protocolCell.id });
    const { props } = renderHeader({
      cells: [markdownCell, protocolCell, macroCell, outputCell],
    });

    const clearButton = screen.getByRole("button", { name: /clear all/i });
    await user.click(clearButton);

    expect(props.onClearOutputs).toHaveBeenCalledOnce();
  });

  it("disables Clear all when there are no output cells", () => {
    renderHeader();

    const clearButton = screen.getByRole("button", { name: /clear all/i });
    expect(clearButton).toBeDisabled();
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
});

// MSW wraps response bodies in Blobs too, so we track which Blob was current
// at each anchor click rather than relying on Blob creation order.
const blobParts: string[] = [];
const clickedBlobIndices: number[] = [];
const OriginalBlob = globalThis.Blob;
class CapturingBlob extends OriginalBlob {
  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    super(parts, options);
    blobParts.push(parts.map((p) => (typeof p === "string" ? p : "")).join(""));
  }
}

type AnchorClickSpy = MockInstance<HTMLAnchorElement["click"]>;

async function readDownload(
  anchorClick: AnchorClickSpy,
): Promise<{ filename: string; payload: unknown }> {
  await waitFor(() => expect(anchorClick).toHaveBeenCalled());
  const lastCall = anchorClick.mock.contexts.at(-1) as HTMLAnchorElement | undefined;
  const filename = lastCall?.download ?? "";
  const text = blobParts.at(-1) ?? "";
  return { filename, payload: JSON.parse(text) as unknown };
}

async function readAllDownloads(
  anchorClick: AnchorClickSpy,
  expected: number,
): Promise<{ filename: string; text: string }[]> {
  await waitFor(() => expect(anchorClick.mock.contexts.length).toBe(expected));
  return anchorClick.mock.contexts.map((ctx, i) => ({
    filename: (ctx as HTMLAnchorElement).download,
    text: blobParts[clickedBlobIndices[i] ?? -1] ?? "",
  }));
}

describe("WorkbookHeader — export menu", () => {
  let anchorClick: AnchorClickSpy;

  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      // The download Blob is the most recent one created before the click.
      clickedBlobIndices.push(blobParts.length - 1);
    });
    globalThis.Blob = CapturingBlob as unknown as typeof Blob;
    blobParts.length = 0;
    clickedBlobIndices.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("exports each protocol as its own JSON file containing the raw protocol code", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({
        id: "proto-1",
        name: "Light Sensor",
        code: [{ _protocol_set_: [{ pulses: 1 }] }],
      }),
    });

    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export protocol only/i }));

    const [download] = await readAllDownloads(anchorClick, 1);
    expect(download.filename).toBe("light-sensor.json");
    // The file contains the raw protocol code array, not a wrapper.
    expect(JSON.parse(download.text)).toEqual([{ _protocol_set_: [{ pulses: 1 }] }]);
  });

  it("triggers one download per protocol cell when multiple protocols are present", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "any", name: "Shared", code: [{ a: 1 }] }),
    });

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

    const downloads = await readAllDownloads(anchorClick, 2);
    expect(downloads).toHaveLength(2);
    for (const d of downloads) {
      expect(d.filename).toBe("shared.json");
      expect(JSON.parse(d.text)).toEqual([{ a: 1 }]);
    }
  });

  it("exports each macro as its own source file named after the macro with a language extension", async () => {
    server.mount(contract.macros.getMacro, {
      body: createMacro({
        id: "macro-1",
        name: "Chlorophyll Calc",
        // DB filename is a placeholder; export uses the macro's display name.
        filename: "seed_macro_e5664d67.py",
        language: "python",
        // The wire format is base64-encoded; export must decode it.
        code: btoa("print('hello')"),
      }),
    });

    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /export macro only/i }));

    const [download] = await readAllDownloads(anchorClick, 1);
    expect(download.filename).toBe("chlorophyll-calc.py");
    expect(download.text).toBe("print('hello')");
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
