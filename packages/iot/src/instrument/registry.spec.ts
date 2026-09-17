import { describe, expect, it, vi } from "vitest";

import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import {
  BENCH_INSTRUMENTS,
  BENCH_PROBE_TIMEOUT_MS,
  benchInstrumentForHandshake,
  identifyBenchInstrument,
} from "./registry";

function respondingWith(reply: string): MockTransport {
  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation(() => {
    setTimeout(() => transport.simulateData(reply), 0);
    return Promise.resolve();
  });
  return transport;
}

describe("bench instrument registry", () => {
  it("identifies a supply from whatever it answers on the port", async () => {
    const transport = respondingWith("KIPRIM,DC310S,25011669,FV:V5.2.0\n");

    const identification = await identifyBenchInstrument(transport);

    expect(identification?.instrument.model).toBe("kiprim-dc");
  });

  // Discovery is by identity reply, not by port order or configuration, so a
  // vendor's formatting around the token does not have to be anticipated.
  it("matches the token inside a longer vendor string, case-insensitively", async () => {
    const transport = respondingWith("  kiprim technologies,dc source,0001,v2\r\n");

    const identification = await identifyBenchInstrument(transport);

    expect(identification?.instrument.model).toBe("kiprim-dc");
  });

  // The reference answers Ctrl-A, not *IDN?, so the probe order has to reach it.
  // Two roles can be served by one instrument class and told apart only by the name
  // the unit reports, so the class alone does not answer "is this the declared role".
  it("surfaces the identity reply beside the instrument, so a caller can match a declared role", async () => {
    const transport = respondingWith("KIPRIM,DC310S,25011669,FV:V5.2.0\n");

    const identification = await identifyBenchInstrument(transport);

    expect(identification?.reply).toBe("KIPRIM,DC310S,25011669,FV:V5.2.0");
  });

  it("returns null for an instrument nothing recognises", async () => {
    const transport = respondingWith("KEITHLEY INSTRUMENTS,MODEL 2450,04123456,1.7.12b\n");

    expect(await identifyBenchInstrument(transport)).toBeNull();
  });

  // Every candidate asks the same port in turn, so the operator waiting on Connect pays
  // the sum of them. Each gets the probe budget, not its own working timeout.
  it("returns null rather than hanging when the port stays silent, within the probe budget", async () => {
    const startedAt = performance.now();

    expect(await identifyBenchInstrument(createMockTransport())).toBeNull();

    const spent = performance.now() - startedAt;
    expect(spent).toBeLessThan(BENCH_INSTRUMENTS.length * BENCH_PROBE_TIMEOUT_MS * 1.5);
  });

  describe("procedure authoring", () => {
    // Lets a definition editor tell an author that a declared handshake names
    // nothing the platform can drive, before anyone carries a rig to a bench.
    it("resolves a declared handshake without touching hardware", () => {
      expect(benchInstrumentForHandshake("KIPRIM")?.model).toBe("kiprim-dc");
    });

    it("declares the setpoints a procedure may drive, with their limits", () => {
      const instrument = benchInstrumentForHandshake("KIPRIM");

      expect(instrument?.setpoints.map((setpoint) => setpoint.name)).toEqual([
        "current_a",
        "voltage_v",
      ]);
      expect(instrument?.setpoints[0]).toMatchObject({ unit: "A", min: 0 });
    });
  });
});
