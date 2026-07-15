import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useIotConnections } from "./useIotConnections";

const mockCreateAdapter = vi.fn();
const mockCreateDriver = vi.fn();

vi.mock("../useIotCommunication/useIotCommunication", () => ({
  createAdapter: (...args: unknown[]) => mockCreateAdapter(...args) as unknown,
  createDriver: (...args: unknown[]) => mockCreateDriver(...args) as unknown,
}));

interface FakeAdapter {
  onStatusChanged: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emitStatus: (connected: boolean) => void;
}

function makeAdapter(): FakeAdapter {
  let statusCb: ((connected: boolean) => void) | undefined;
  return {
    onStatusChanged: vi.fn((cb: (connected: boolean) => void) => {
      statusCb = cb;
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    emitStatus: (connected: boolean) => statusCb?.(connected),
  };
}

function makeDriver() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useIotConnections", () => {
  beforeEach(() => {
    mockCreateAdapter.mockReset();
    mockCreateDriver.mockReset();
  });

  it("accumulates devices with numbered labels in connect order", async () => {
    const adapters = [makeAdapter(), makeAdapter()];
    mockCreateAdapter.mockResolvedValueOnce(adapters[0]).mockResolvedValueOnce(adapters[1]);
    mockCreateDriver.mockImplementation(() => makeDriver());

    const { result } = renderHook(() => useIotConnections("multispeq"));

    await act(() => result.current.connect("serial"));
    await act(() => result.current.connect("serial"));

    expect(mockCreateAdapter).toHaveBeenCalledWith("multispeq", "serial");
    expect(result.current.connections.map((c) => c.label)).toEqual(["Device #1", "Device #2"]);
    expect(result.current.error).toBeNull();
  });

  it("connects mock devices without a browser adapter", async () => {
    mockCreateDriver.mockImplementation(() => makeDriver());

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));

    expect(mockCreateAdapter).not.toHaveBeenCalled();
    expect(result.current.connections.map((c) => c.label)).toEqual(["Mock MultispeQ 1"]);
  });

  it("records the error and releases the adapter when connect fails", async () => {
    const adapter = makeAdapter();
    mockCreateAdapter.mockResolvedValue(adapter);
    const driver = makeDriver();
    driver.initialize.mockRejectedValue(new Error("port is busy"));
    mockCreateDriver.mockReturnValue(driver);

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));

    expect(result.current.connections).toHaveLength(0);
    expect(result.current.error).toBe("port is busy");
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("disconnectDevice removes exactly that device and destroys its driver", async () => {
    const drivers = [makeDriver(), makeDriver()];
    mockCreateDriver.mockReturnValueOnce(drivers[0]).mockReturnValueOnce(drivers[1]);

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.connect("mock"));

    const first = result.current.connections[0];
    await act(() => result.current.disconnectDevice(first.id));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Mock MultispeQ 2"]);
    expect(drivers[0].destroy).toHaveBeenCalled();
    expect(drivers[1].destroy).not.toHaveBeenCalled();

    // Unknown ids are a no-op.
    await act(() => result.current.disconnectDevice("nope"));
    expect(result.current.connections).toHaveLength(1);
  });

  it("disconnectAll empties the registry and destroys every driver", async () => {
    const drivers = [makeDriver(), makeDriver()];
    mockCreateDriver.mockReturnValueOnce(drivers[0]).mockReturnValueOnce(drivers[1]);

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.connect("mock"));

    await act(() => result.current.disconnectAll());

    expect(result.current.connections).toHaveLength(0);
    expect(drivers[0].destroy).toHaveBeenCalled();
    expect(drivers[1].destroy).toHaveBeenCalled();
  });

  it("drops only the reporting device when its transport disconnects", async () => {
    const adapters = [makeAdapter(), makeAdapter()];
    mockCreateAdapter.mockResolvedValueOnce(adapters[0]).mockResolvedValueOnce(adapters[1]);
    mockCreateDriver.mockImplementation(() => makeDriver());

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("serial"));
    await act(() => result.current.connect("serial"));

    act(() => adapters[0].emitStatus(false));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Device #2"]);
  });

  it("keeps numbering unique after disconnects", async () => {
    mockCreateDriver.mockImplementation(() => makeDriver());

    const { result } = renderHook(() => useIotConnections("multispeq"));
    await act(() => result.current.connect("mock"));
    await act(() => result.current.disconnectAll());
    await act(() => result.current.connect("mock"));

    expect(result.current.connections.map((c) => c.label)).toEqual(["Mock MultispeQ 2"]);
  });
});
