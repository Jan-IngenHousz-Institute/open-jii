import { describe, it, expect, vi, afterEach } from "vitest";

import { AmbitConnector } from "../driver/ambit/connector";
import { GenericCommandConnector } from "../driver/generic/command-connector";
import { GenericDeviceDriver } from "../driver/generic/driver";
import { MultispeqDriver } from "../driver/multispeq/driver";
import type { ITransportAdapter } from "../transport/interface";
import { createConnectorForFamily, identifyDevice } from "./identify-device";

const HELLO = "hello\r\n";
const INFO = '{"command":"INFO"}\n';

type MockTransport = ITransportAdapter & {
  simulateData: (data: string) => void;
  sent: string[];
};

/**
 * Mock transport with the concrete adapters' single-callback replace
 * semantics. `onSend` can reply asynchronously (setTimeout 0) per payload.
 */
function createMockTransport(
  onSend?: (payload: string, reply: (data: string) => void) => void,
): MockTransport {
  let dataCallback: ((data: string) => void) | undefined;
  const sent: string[] = [];

  return {
    sent,
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn((payload: string) => {
      sent.push(payload);
      onSend?.(payload, (data) => {
        setTimeout(() => dataCallback?.(data), 0);
      });
      return Promise.resolve();
    }),
    onDataReceived: vi.fn((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulateData(data: string) {
      dataCallback?.(data);
    },
  };
}

const GENERIC_INFO = {
  device_name: "WeatherBox",
  device_type: "sensor",
  device_id: "wb-01",
  firmware_version: "1.2.3",
};

/** An onSend handler answering the INFO probe with a success envelope. */
const infoReply =
  (data: Record<string, unknown>) => (payload: string, reply: (d: string) => void) => {
    if (payload === INFO) reply(JSON.stringify({ status: "success", data }) + "\n");
  };

describe("identifyDevice", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("identifies a MultispeQ from the hello probe, enriches it, and hands the transport over", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) reply("MultispeQ Ready\n");
      if (payload === "battery\r\n") reply("battery:87\n");
      if (payload === "temp\r\n") reply('{"t":21}ABCD1234\n');
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 100 });

    expect(identified.family).toBe("multispeq");
    expect(identified.connector).toBeInstanceOf(MultispeqDriver);
    expect(identified.info.family).toBe("multispeq");
    expect(identified.info.name).toBe("MultispeQ Ready");
    expect(identified.info.batteryPercent).toBe(87);

    // execute() round-trips through the driver framing on the same transport.
    const result = await identified.connector.execute("temp");
    expect(transport.sent).toContain("temp\r\n");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ t: 21 });
    expect(result.checksum).toBe("ABCD1234");
  });

  it("falls through to the INFO probe and picks the generic driver", async () => {
    const transport = createMockTransport(infoReply(GENERIC_INFO));

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("generic");
    expect(identified.connector).toBeInstanceOf(GenericDeviceDriver);
    expect(identified.connector).not.toBeInstanceOf(AmbitConnector);
    expect(identified.info.name).toBe("WeatherBox");
    expect(identified.info.deviceId).toBe("wb-01");
    expect(identified.info.firmwareVersion).toBe("1.2.3");
    expect(identified.info.raw).toMatchObject(GENERIC_INFO);
    // Default retry: hello went out twice before INFO; the generic driver's
    // initialize() then re-probes INFO, so the mock answered it twice.
    expect(transport.sent.filter((p) => p === HELLO)).toHaveLength(2);
    expect(transport.sent.filter((p) => p === INFO)).toHaveLength(2);
  });

  it("maps device_type ambit onto the AmbitConnector", async () => {
    const transport = createMockTransport(infoReply({ ...GENERIC_INFO, device_type: "ambit" }));

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("ambit");
    expect(identified.connector).toBeInstanceOf(AmbitConnector);
    expect(identified.info.family).toBe("ambit");
  });

  it("falls back to the raw GenericCommandConnector on total silence without throwing", async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();

    const promise = identifyDevice(transport);
    // Default budgets: hello (2000), hello retry (2000), INFO (2000).
    for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(2000);

    const identified = await promise;

    expect(identified.family).toBe("generic");
    expect(identified.connector).toBeInstanceOf(GenericCommandConnector);
    expect(identified.info).toEqual({ family: "generic", raw: {} });
    expect(transport.disconnect).not.toHaveBeenCalled();
  });

  it("clears hello-probe noise from the accumulator before the INFO probe", async () => {
    const answerInfo = infoReply(GENERIC_INFO);
    const transport = createMockTransport((payload, reply) => {
      // Newline-less garbage never completes the hello probe
      if (payload === HELLO) reply("$$boot-garbage");
      answerInfo(payload, reply);
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30, helloRetries: 0 });

    // Were the accumulator not reset, the garbage would corrupt the INFO line.
    expect(identified.family).toBe("generic");
    expect(identified.connector).toBeInstanceOf(GenericDeviceDriver);
  });

  it("sends nothing when assumeFamily is given; transport send errors propagate", async () => {
    const transport = createMockTransport();

    const identified = await identifyDevice(transport, { assumeFamily: "multispeq" });

    expect(transport.send).not.toHaveBeenCalled();
    expect(identified.family).toBe("multispeq");
    expect(identified.connector).toBeInstanceOf(MultispeqDriver);
    expect(identified.info).toEqual({ family: "multispeq", raw: {} });
    // The connector still took over the transport
    expect(transport.onDataReceived).toHaveBeenCalled();

    vi.mocked(transport.send).mockRejectedValue(new Error("port closed"));
    await expect(identifyDevice(transport)).rejects.toThrow("port closed");
    expect(transport.disconnect).not.toHaveBeenCalled();
  });

  it("retries a silent hello before giving up on multispeq", async () => {
    let helloCount = 0;
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) {
        helloCount++;
        // Silent first attempt; answers from the retry onwards (the driver's
        // getDeviceInfo enrichment sends hello again through its framing).
        if (helloCount >= 2) reply("Instrument Ready\n");
      }
      if (payload === "battery\r\n") reply("battery:55\n");
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("multispeq");
    expect(transport.sent[0]).toBe(HELLO);
    expect(transport.sent[1]).toBe(HELLO);
    expect(identified.info.batteryPercent).toBe(55);
  });
});

describe("createConnectorForFamily", () => {
  it("builds the concrete connector per family and stamps it with that family", () => {
    expect(createConnectorForFamily("multispeq")).toBeInstanceOf(MultispeqDriver);
    expect(createConnectorForFamily("ambit")).toBeInstanceOf(AmbitConnector);
    const generic = createConnectorForFamily("generic");
    expect(generic).toBeInstanceOf(GenericDeviceDriver);
    expect(generic).not.toBeInstanceOf(AmbitConnector);
    for (const family of ["multispeq", "ambit", "generic"] as const) {
      expect(createConnectorForFamily(family).family).toBe(family);
    }
  });
});
