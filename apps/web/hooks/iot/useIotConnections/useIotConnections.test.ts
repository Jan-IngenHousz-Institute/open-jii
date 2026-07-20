import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { DeviceIdentity } from "@repo/iot";

import { useIotConnections } from "./useIotConnections";

const mockCreateAdapter = vi.fn();
const mockIdentifyDevice = vi.fn();
const mockToast = vi.fn();

vi.mock("../useIotCommunication/useIotCommunication", () => ({
  createAdapter: (...args: unknown[]) => mockCreateAdapter(...args) as unknown,
}));

vi.mock("@repo/iot", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  identifyDevice: (...args: unknown[]) => mockIdentifyDevice(...args) as unknown,
}));

vi.mock("@repo/ui/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args) as unknown,
}));

interface FakeAdapter {
  onStatusChanged: ReturnType<typeof vi.fn>;
  onDataReceived: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emitStatus: (connected: boolean) => void;
}

function makeAdapter(): FakeAdapter {
  let statusCb: ((connected: boolean) => void) | undefined;
  return {
    onStatusChanged: vi.fn((cb: (connected: boolean) => void) => {
      statusCb = cb;
    }),
    onDataReceived: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    emitStatus: (connected: boolean) => statusCb?.(connected),
  };
}

function makeConnector() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

/** Queue an identifyDevice resolution: family + optional name + a fresh connector. */
function identifyAs(family: DeviceIdentity["family"], name?: string) {
  const connector = makeConnector();
  mockIdentifyDevice.mockResolvedValueOnce({
    family,
    info: { family, name, raw: {} },
    connector,
  });
  return connector;
}

describe("useIotConnections", () => {
  beforeEach(() => {
    mockCreateAdapter.mockReset();
    mockIdentifyDevice.mockReset();
    mockToast.mockReset();
    window.history.replaceState({}, "", "/");
  });

  it("accumulates devices with numbered labels in connect order", async () => {
    const adapters = [makeAdapter(), makeAdapter()];
    mockCreateAdapter.mockResolvedValueOnce(adapters[0]).mockResolvedValueOnce(adapters[1]);
    identifyAs("multispeq");
    identifyAs("multispeq");

    const { result } = renderHook(() => useIotConnections("multispeq"));

    await act(() => result.current.connect("serial"));
    await act(() => result.current.connect("serial"));

    expect(mockCreateAdapter).toHaveBeenCalledWith("multispeq", "serial");
    expect(result.current.connections.map((c) => c.label)).toEqual(["Device #1", "Device #2"]);
    expect(result.current.connections.map((c) => c.family)).toEqual(["multispeq", "multispeq"]);
    expect(result.current.error).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("labels a device by its identified name and stores the identity", async () => {
    mockCreateAdapter.mockResolvedValue(makeAdapter());
    identifyAs("multispeq", "MultispeQ");

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));

    expect(result.current.connections[0].label).toBe("MultispeQ");
    expect(result.current.connections[0].identity).toEqual({
      family: "multispeq",
      name: "MultispeQ",
      raw: {},
    });
  });

  it("lets the identified family outrank the toolbar family, with a toast", async () => {
    mockCreateAdapter.mockResolvedValue(makeAdapter());
    identifyAs("ambit", "NEW Name Here");

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));

    expect(result.current.connections[0].family).toBe("ambit");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Different device identified" }),
    );
  });

  it("connects mock devices without a browser adapter", async () => {
    identifyAs("multispeq", "Mock MultispeQ 1");

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));

    expect(mockCreateAdapter).not.toHaveBeenCalled();
    expect(result.current.connections.map((c) => c.label)).toEqual(["Mock MultispeQ 1"]);
  });

  it("records the error and releases the adapter when connect fails", async () => {
    const adapter = makeAdapter();
    mockCreateAdapter.mockResolvedValue(adapter);
    mockIdentifyDevice.mockRejectedValue(new Error("port is busy"));

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));

    expect(result.current.connections).toHaveLength(0);
    expect(result.current.error).toBe("port is busy");
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("disconnectDevice removes exactly that device and destroys its driver", async () => {
    const connectors = [identifyAs("multispeq", "Mock MultispeQ 1")];
    connectors.push(identifyAs("multispeq", "Mock MultispeQ 2"));

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.connect("mock"));

    const first = result.current.connections[0];
    await act(() => result.current.disconnectDevice(first.id));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Mock MultispeQ 2"]);
    expect(connectors[0].destroy).toHaveBeenCalled();
    expect(connectors[1].destroy).not.toHaveBeenCalled();

    // Unknown ids are a no-op.
    await act(() => result.current.disconnectDevice("nope"));
    expect(result.current.connections).toHaveLength(1);
  });

  it("disconnectAll empties the registry and destroys every driver", async () => {
    const connectors = [identifyAs("multispeq"), identifyAs("multispeq")];

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.connect("mock"));

    await act(() => result.current.disconnectAll());

    expect(result.current.connections).toHaveLength(0);
    expect(connectors[0].destroy).toHaveBeenCalled();
    expect(connectors[1].destroy).toHaveBeenCalled();
  });

  it("drops only the reporting device when its transport disconnects", async () => {
    const adapters = [makeAdapter(), makeAdapter()];
    mockCreateAdapter.mockResolvedValueOnce(adapters[0]).mockResolvedValueOnce(adapters[1]);
    identifyAs("multispeq");
    identifyAs("multispeq");

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));
    await act(() => result.current.connect("serial"));

    act(() => adapters[0].emitStatus(false));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Device #2"]);
  });

  it("keeps numbering unique after disconnects", async () => {
    identifyAs("multispeq");
    identifyAs("multispeq");

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.disconnectAll());
    await act(() => result.current.connect("mock"));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Device #2"]);
  });
});
