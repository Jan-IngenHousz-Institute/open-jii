import { describe, expect, it, vi } from "vitest";

import type { MockTransport } from "../../driver/testing/mock-transport";
import { createMockTransport } from "../../driver/testing/mock-transport";
import { handshakeMatches, identityMatches } from "../interface";
import { MiniParReference } from "./instrument";

const HELLO = "MiniPAR,1.1,1.04\n";

/** A minipar console: a scripted reply per wire payload, silence for anything else. */
function miniparConsole(table: Partial<Record<string, string>>): MockTransport {
  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation((payload: string) => {
    const reply = table[payload];
    if (reply !== undefined) {
      setTimeout(() => transport.simulateData(reply), 0);
    }
    return Promise.resolve();
  });
  return transport;
}

function named(name: string): MockTransport {
  return miniparConsole({ "hello\n": HELLO, "get_name\n": `${name}\n` });
}

async function reference(transport: MockTransport): Promise<MiniParReference> {
  const instrument = new MiniParReference({ identifyTimeoutMs: 300, readTimeoutMs: 300 });
  await instrument.initialize(transport);
  return instrument;
}

describe("MiniParReference", () => {
  it("identifies both bench units as this model and carries the name that tells them apart", async () => {
    const parRef = await reference(named("Par_REF"));
    const emitLed = await reference(named("Emit_LED"));

    const parReply = await parRef.identify();
    const emitReply = await emitLed.identify();

    expect(identityMatches(parRef, parReply)).toBe(true);
    expect(identityMatches(emitLed, emitReply)).toBe(true);

    expect(handshakeMatches(parReply, "Par_REF")).toBe(true);
    expect(handshakeMatches(parReply, "Emit_LED")).toBe(false);
    expect(handshakeMatches(emitReply, "Emit_LED")).toBe(true);
    expect(handshakeMatches(emitReply, "Par_REF")).toBe(false);
  });

  it("asks hello before get_name", async () => {
    const transport = named("Par_REF");
    const instrument = await reference(transport);

    await instrument.identify();

    expect(vi.mocked(transport.send).mock.calls.map(([payload]) => payload)).toEqual([
      "hello\n",
      "get_name\n",
    ]);
  });

  it("reads a calibrated and an uncalibrated PAR value as numbers", async () => {
    const instrument = await reference(
      miniparConsole({ "par\n": "\n345.61\n", "par_raw\n": "396.96\n" }),
    );

    await expect(instrument.read("par")).resolves.toBe(345.61);
    await expect(instrument.read("par_raw")).resolves.toBe(396.96);
  });

  it("keeps the spectrometer's channel counts whole", async () => {
    const instrument = await reference(
      miniparConsole({ "spec_raw\n": "120,145,168,190,201,233\n" }),
    );

    await expect(instrument.read("spec_raw")).resolves.toBe("120,145,168,190,201,233");
  });

  it("declares its readings and no setpoints", () => {
    const instrument = new MiniParReference();

    expect(instrument.readings.map((reading) => reading.name)).toEqual([
      "par",
      "par_raw",
      "spec_raw",
    ]);
    expect(instrument.setpoints).toEqual([]);
  });

  it("destroys the driver it owns", async () => {
    const transport = miniparConsole({ "par\n": "345.61\n" });
    const instrument = await reference(transport);

    await instrument.destroy();

    expect(transport.disconnect).toHaveBeenCalledOnce();
    await expect(instrument.read("par")).rejects.toThrow(/not initialized/);
  });

  describe("guards", () => {
    it("surfaces a reading the console refuses", async () => {
      const instrument = await reference(miniparConsole({ "par\n": "error:sensor_missing\n" }));

      await expect(instrument.read("par")).rejects.toThrow(/error:sensor_missing/);
    });

    it("rejects when the console stays silent", async () => {
      const instrument = await reference(miniparConsole({}));

      await expect(instrument.read("par")).rejects.toThrow(/Response timeout/);
    });

    it("refuses a reading it does not have", async () => {
      const instrument = await reference(named("Par_REF"));

      await expect(instrument.read("tph")).rejects.toThrow(/no reading "tph"/);
    });

    it("refuses to apply any setpoint", async () => {
      const instrument = await reference(named("Par_REF"));

      await expect(instrument.applySetpoint("current_a", 1)).rejects.toThrow(/no setpoint/);
    });

    it("refuses to identify before a transport is attached", async () => {
      const instrument = new MiniParReference();

      await expect(instrument.identify()).rejects.toThrow(/not initialized/);
    });

    // The reading a fit is anchored on, so "NaN" or a truncated line has to fail here
    // rather than travel into the payload as a text cell.
    it("refuses a PAR reading that is not a number", async () => {
      const instrument = await reference(miniparConsole({ "par\n": "NaN\n" }));

      await expect(instrument.read("par")).rejects.toThrow(/not a number/);
    });

    // A unit that cannot say which one it is cannot be bound to a role.
    it("refuses to identify a unit that will not answer get_name", async () => {
      const instrument = await reference(miniparConsole({ "hello\n": HELLO }));

      await expect(instrument.identify()).rejects.toThrow(/Response timeout/);
    });

    it("has nothing to shut down, and writes nothing to find that out", async () => {
      const transport = named("Par_REF");
      const instrument = await reference(transport);
      vi.mocked(transport.send).mockClear();

      await expect(instrument.shutdown()).resolves.toBeUndefined();

      expect(transport.send).not.toHaveBeenCalled();
    });
  });
});
