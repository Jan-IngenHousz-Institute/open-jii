import { describe, expect, it, vi } from "vitest";

import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import { benchInstrumentForHandshake, identifyBenchInstrument } from "./registry";

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

    const instrument = await identifyBenchInstrument(transport);

    expect(instrument?.model).toBe("kiprim-dc");
  });

  // Discovery is by identity reply, not by port order or configuration, so a
  // vendor's formatting around the token does not have to be anticipated.
  it("matches the token inside a longer vendor string, case-insensitively", async () => {
    const transport = respondingWith("  kiprim technologies,dc source,0001,v2\r\n");

    const instrument = await identifyBenchInstrument(transport);

    expect(instrument?.model).toBe("kiprim-dc");
  });

  // The reference answers Ctrl-A, not *IDN?, so the probe order has to reach it.
  it("identifies a MicroPython reference by its raw-REPL banner", async () => {
    const transport = createMockTransport();
    vi.mocked(transport.send).mockImplementation((sent: string) => {
      if (sent === "\x01") {
        setTimeout(() => transport.simulateData("raw REPL; CTRL-B to exit\r\n>"), 0);
      }
      return Promise.resolve();
    });

    const instrument = await identifyBenchInstrument(transport);

    expect(instrument?.model).toBe("micropython-par-reference");
  });

  it("returns null for an instrument nothing recognises", async () => {
    const transport = respondingWith("KEITHLEY INSTRUMENTS,MODEL 2450,04123456,1.7.12b\n");

    expect(await identifyBenchInstrument(transport)).toBeNull();
  });

  it("returns null rather than hanging when the port stays silent", async () => {
    expect(await identifyBenchInstrument(createMockTransport())).toBeNull();
  });

  describe("procedure authoring", () => {
    // Lets a definition editor tell an author that a declared handshake names
    // nothing the platform can drive, before anyone carries a rig to a bench.
    it("resolves a declared handshake without touching hardware", () => {
      expect(benchInstrumentForHandshake("KIPRIM")?.model).toBe("kiprim-dc");
      expect(benchInstrumentForHandshake("raw REPL")?.model).toBe("micropython-par-reference");
      expect(benchInstrumentForHandshake("Par_REF")).toBeNull();
    });

    it("declares the readings a procedure may take from a reference", () => {
      const reference = benchInstrumentForHandshake("raw REPL");

      expect(reference?.readings?.map((reading) => reading.name)).toEqual(["par"]);
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
