import { describe, it, expect, vi, afterEach } from "vitest";

import { AmbitDriver } from "../driver/ambit/driver";
import { GenericCommandConnector } from "../driver/generic/command-connector";
import { GenericDeviceDriver } from "../driver/generic/driver";
import { MiniParDriver } from "../driver/minipar/driver";
import { MultispeqDriver } from "../driver/multispeq/driver";
import type { ITransportAdapter } from "../transport/interface";
import { createConnectorForFamily, identifyDevice } from "./identify-device";

const HELLO = "hello\r\n";
const INFO = '{"command":"INFO"}\n';

const MULTISPEQ_DEVICE_INFO =
  '{"device_name":"MultispeQ","device_version":"2","device_id":"aa:bb:cc:dd","device_battery":87,"device_firmware":"2.311"}CAFEBABE\n';

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

  it("identifies a MultispeQ from the hello probe, enriches via device_info, and hands the transport over", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) reply("MultispeQ Ready\n");
      if (payload === "device_info\r\n") reply(MULTISPEQ_DEVICE_INFO);
      if (payload === "temp\r\n") reply('{"t":21}ABCD1234\n');
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 100 });

    expect(identified.family).toBe("multispeq");
    expect(identified.connector).toBeInstanceOf(MultispeqDriver);
    expect(identified.info.family).toBe("multispeq");
    expect(identified.info.name).toBe("MultispeQ");
    expect(identified.info.deviceId).toBe("aa:bb:cc:dd");
    expect(identified.info.firmwareVersion).toBe("2.311");
    expect(identified.info.batteryPercent).toBe(87);
    expect(identified.info.raw.helloReply).toBe("MultispeQ Ready");

    // execute() round-trips through the driver framing on the same transport.
    const result = await identified.connector.execute("temp");
    expect(transport.sent).toContain("temp\r\n");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ t: 21 });
    expect(result.checksum).toBe("ABCD1234");
  });

  it("classifies older firmware's 'Instrument Ready' as multispeq", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) reply("Instrument Ready\n");
      if (payload === "device_info\r\n") reply(MULTISPEQ_DEVICE_INFO);
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 100 });

    expect(identified.family).toBe("multispeq");
    expect(identified.connector).toBeInstanceOf(MultispeqDriver);
  });

  it("classifies the miniPAR JSON hello (no trailing newline) as minipar", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) reply('{"device":"MiniPAR","version":"1.1"}');
      if (payload === "hello\n") reply("MiniPAR,1.1,1.04\n");
      if (payload === "get_name\n") reply("Bench PAR 2\n");
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 50 });

    expect(identified.family).toBe("minipar");
    expect(identified.connector).toBeInstanceOf(MiniParDriver);
    expect(identified.info.name).toBe("Bench PAR 2");
    expect(identified.info.firmwareVersion).toBe("1.04");
  });

  it("classifies the miniPAR CSV hello as minipar with the firmware column", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO) reply("MiniPAR,1.1,1.04");
      if (payload === "hello\n") reply("MiniPAR,1.1,1.04\n");
      if (payload === "get_name\n") reply("NoName\n");
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 50 });

    expect(identified.family).toBe("minipar");
    expect(identified.info.name).toBe("MiniPAR");
    expect(identified.info.firmwareVersion).toBe("1.04");
  });

  it("classifies the Ambit '<name> Ready' hello as ambit and enriches through the AmbitDriver", async () => {
    const transport = createMockTransport((payload, reply) => {
      if (payload === HELLO || payload === "hello\n") reply("NEW Name Here Ready\n");
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 50 });

    expect(identified.family).toBe("ambit");
    expect(identified.connector).toBeInstanceOf(AmbitDriver);
    expect(identified.info.family).toBe("ambit");
    expect(identified.info.name).toBeUndefined();
    expect(identified.info.raw.helloReply).toBe("NEW Name Here Ready");
  });

  it("falls through to the INFO probe and picks the generic driver", async () => {
    const transport = createMockTransport(infoReply(GENERIC_INFO));

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("generic");
    expect(identified.connector).toBeInstanceOf(GenericDeviceDriver);
    expect(identified.info.name).toBe("WeatherBox");
    expect(identified.info.deviceId).toBe("wb-01");
    expect(identified.info.firmwareVersion).toBe("1.2.3");
    expect(identified.info.raw).toMatchObject(GENERIC_INFO);
    // Default retry: hello went out twice before INFO; the generic driver's
    // initialize() then re-probes INFO, so the mock answered it twice.
    expect(transport.sent.filter((p) => p === HELLO)).toHaveLength(2);
    expect(transport.sent.filter((p) => p === INFO)).toHaveLength(2);
  });

  it("maps INFO device_type ambit onto the ambit family", async () => {
    const answerInfo = infoReply({ ...GENERIC_INFO, device_type: "ambit" });
    const transport = createMockTransport((payload, reply) => {
      answerInfo(payload, reply);
      if (payload === "hello\n") reply("NEW WeatherBox Ready\n");
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("ambit");
    expect(identified.info.family).toBe("ambit");
    expect(identified.connector).toBeInstanceOf(AmbitDriver);
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

  it("ignores unclassifiable hello noise and moves on to the INFO probe", async () => {
    const answerInfo = infoReply(GENERIC_INFO);
    const transport = createMockTransport((payload, reply) => {
      // Boot garbage matches no signature and never completes the hello probe
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
        // Silent first attempt; answers from the retry onwards.
        if (helloCount >= 2) reply("Instrument Ready\n");
      }
      if (payload === "device_info\r\n") reply(MULTISPEQ_DEVICE_INFO);
    });

    const identified = await identifyDevice(transport, { probeTimeoutMs: 30 });

    expect(identified.family).toBe("multispeq");
    expect(transport.sent[0]).toBe(HELLO);
    expect(transport.sent[1]).toBe(HELLO);
    expect(identified.info.batteryPercent).toBe(87);
  });
});

describe("createConnectorForFamily", () => {
  it("builds the concrete connector per family and stamps it with that family", () => {
    expect(createConnectorForFamily("multispeq")).toBeInstanceOf(MultispeqDriver);
    expect(createConnectorForFamily("ambit")).toBeInstanceOf(AmbitDriver);
    expect(createConnectorForFamily("minipar")).toBeInstanceOf(MiniParDriver);
    const generic = createConnectorForFamily("generic");
    expect(generic).toBeInstanceOf(GenericDeviceDriver);
    expect(generic).not.toBeInstanceOf(GenericCommandConnector);
    for (const family of ["multispeq", "ambit", "minipar", "generic"] as const) {
      expect(createConnectorForFamily(family).family).toBe(family);
    }
  });
});
