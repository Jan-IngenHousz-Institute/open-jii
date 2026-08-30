import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { MockTransport } from "../../driver/testing/mock-transport";
import { createMockTransport } from "../../driver/testing/mock-transport";
import { KIPRIM_LIMITS } from "./commands";
import { KiprimDcSource } from "./instrument";

const IDN_REPLY = "KIPRIM,DC310S,25011669,FV:V5.2.0\n";

/** Answers a specific payload; anything else stays silent, as the supply does. */
function replyTo(payload: string, reply: string): MockTransport {
  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation((sent: string) => {
    if (sent === payload) {
      setTimeout(() => transport.simulateData(reply), 0);
    }
    return Promise.resolve();
  });
  return transport;
}

async function connected(transport: MockTransport): Promise<KiprimDcSource> {
  const instrument = new KiprimDcSource({ identifyTimeoutMs: 200 });
  await instrument.initialize(transport);
  return instrument;
}

describe("KiprimDcSource", () => {
  it("identifies itself from the *IDN? reply", async () => {
    const transport = replyTo("*IDN?\n", IDN_REPLY);
    const instrument = await connected(transport);

    const reply = await instrument.identify();

    expect(reply).toContain("KIPRIM");
    expect(transport.send).toHaveBeenCalledWith("*IDN?\n");
  });

  it("rejects when nothing answers the identity query", async () => {
    const instrument = await connected(createMockTransport());

    await expect(instrument.identify()).rejects.toThrow(/did not answer/);
  });

  // Three decimals and CRLF are the firmware's format, not a preference.
  it("writes a current setpoint in the firmware's exact format", async () => {
    const transport = replyTo("*IDN?\n", IDN_REPLY);
    const instrument = await connected(transport);

    await instrument.applySetpoint("current_a", 2.4);

    expect(transport.send).toHaveBeenCalledWith("current 2.400\r\n");
  });

  it("writes a voltage setpoint", async () => {
    const transport = replyTo("*IDN?\n", IDN_REPLY);
    const instrument = await connected(transport);

    await instrument.applySetpoint("voltage_v", 12);

    expect(transport.send).toHaveBeenCalledWith("voltage 12.000\r\n");
  });

  it("drives the whole Ambit PAR sweep, ending back at zero", async () => {
    const transport = replyTo("*IDN?\n", IDN_REPLY);
    const instrument = await connected(transport);

    for (const amps of [0.8, 2.4, 3.0, 4.0, 6.6, 0.0]) {
      await instrument.applySetpoint("current_a", amps);
    }

    expect(vi.mocked(transport.send).mock.calls.map(([payload]) => payload)).toEqual([
      "current 0.800\r\n",
      "current 2.400\r\n",
      "current 3.000\r\n",
      "current 4.000\r\n",
      "current 6.600\r\n",
      "current 0.000\r\n",
    ]);
  });

  describe("guards", () => {
    it("refuses a setpoint it does not have", async () => {
      const instrument = await connected(createMockTransport());

      await expect(instrument.applySetpoint("wavelength_nm", 630)).rejects.toThrow(
        /no setpoint "wavelength_nm"/,
      );
    });

    // A malformed procedure must not be able to drive a calibration lamp past
    // what the supply can deliver.
    it("refuses a current above the supply's ceiling", async () => {
      const instrument = await connected(createMockTransport());

      await expect(
        instrument.applySetpoint("current_a", KIPRIM_LIMITS.CURRENT_MAX_A + 1),
      ).rejects.toThrow(/between 0 and 10 A/);
    });

    it("refuses a negative or non-finite setpoint", async () => {
      const instrument = await connected(createMockTransport());

      await expect(instrument.applySetpoint("current_a", -1)).rejects.toThrow(/between/);
      await expect(instrument.applySetpoint("current_a", Number.NaN)).rejects.toThrow(/between/);
    });

    it("refuses to act before a transport is attached", async () => {
      const instrument = new KiprimDcSource();

      await expect(instrument.applySetpoint("current_a", 1)).rejects.toThrow(
        /transport not initialized/i,
      );
    });
  });

  describe("shutdown", () => {
    // A lamp left at 6.6 A after an aborted sweep is a hazard.
    it("returns the lamp to zero current", async () => {
      const transport = replyTo("*IDN?\n", IDN_REPLY);
      const instrument = await connected(transport);
      await instrument.applySetpoint("current_a", 6.6);
      vi.mocked(transport.send).mockClear();

      await instrument.shutdown();

      expect(transport.send).toHaveBeenCalledWith("current 0.000\r\n");
    });

    it("is a no-op when no transport was ever attached", async () => {
      await expect(new KiprimDcSource().shutdown()).resolves.toBeUndefined();
    });

    // The supply owes one short identity line; a miswired port streaming
    // indefinitely must not grow the buffer without bound.
    it("discards an oversized receive buffer instead of growing it", async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const transport = createMockTransport();
      const instrument = new KiprimDcSource({ identifyTimeoutMs: 50 }, logger);
      await instrument.initialize(transport);

      transport.simulateData("x".repeat(DEFAULT_MAX_BUFFER_SIZE + 1));

      expect(logger.error).toHaveBeenCalledWith(
        "Kiprim receive buffer exceeded max size, discarding data",
      );
      // The flood is gone, so a real reply arriving next still parses.
      transport.simulateData("KIPRIM,DC,0001,V1\n");
      await expect(instrument.identify()).rejects.toThrow(/did not answer/);
    });

    it("still releases the transport when the zeroing write fails", async () => {
      const transport = createMockTransport();
      const instrument = await connected(transport);
      vi.mocked(transport.send).mockRejectedValue(new Error("port closed"));

      await expect(instrument.destroy()).resolves.toBeUndefined();
      await expect(instrument.applySetpoint("current_a", 1)).rejects.toThrow(
        /transport not initialized/i,
      );
    });
  });
});
