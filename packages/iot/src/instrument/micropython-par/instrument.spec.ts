import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { MockTransport } from "../../driver/testing/mock-transport";
import { createMockTransport } from "../../driver/testing/mock-transport";
import { MicroPythonParReference } from "./instrument";

const RAW_BANNER = "raw REPL; CTRL-B to exit\r\n>";

/** A REPL: echoes `getPAR()`, then prints the value, then a prompt. */
function repl(parValue: string): MockTransport {
  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation((sent: string) => {
    if (sent === "\x01") {
      setTimeout(() => transport.simulateData(RAW_BANNER), 0);
    } else if (sent === "getPAR()\r") {
      setTimeout(() => transport.simulateData(`getPAR()\r\n${parValue}\r\n>>> `), 0);
    }
    return Promise.resolve();
  });
  return transport;
}

async function connected(transport: MockTransport): Promise<MicroPythonParReference> {
  const instrument = new MicroPythonParReference({ identifyTimeoutMs: 200, readTimeoutMs: 200 });
  await instrument.initialize(transport);
  return instrument;
}

describe("MicroPythonParReference", () => {
  it("identifies by the raw-REPL banner", async () => {
    const instrument = await connected(repl("0.69"));

    const reply = await instrument.identify();

    expect(reply).toContain("raw REPL");
  });

  // The board's own script defines getPAR(); interrupting it to identify
  // means it has to be rebooted before the first read will answer.
  it("leaves raw mode and soft-reboots after identifying", async () => {
    const transport = repl("0.69");
    const instrument = await connected(transport);

    await instrument.identify();

    expect(vi.mocked(transport.send).mock.calls.map(([payload]) => payload)).toEqual([
      "\x01",
      "\x02\x04",
    ]);
  });

  it("reads PAR from the line after the REPL echo", async () => {
    const instrument = await connected(repl("0.6893559"));

    await expect(instrument.read("par")).resolves.toBeCloseTo(0.6893559, 6);
  });

  it("declares its one reading for procedure authors", () => {
    const instrument = new MicroPythonParReference();

    expect(instrument.readings.map((reading) => reading.name)).toEqual(["par"]);
    expect(instrument.setpoints).toEqual([]);
  });

  describe("guards", () => {
    it("refuses a reading it does not have", async () => {
      const instrument = await connected(repl("1"));

      await expect(instrument.read("temperature")).rejects.toThrow(/no reading "temperature"/);
    });

    it("refuses to apply any setpoint", async () => {
      const instrument = await connected(repl("1"));

      await expect(instrument.applySetpoint("current_a", 1)).rejects.toThrow(/no setpoint/);
    });

    it("rejects a non-numeric answer rather than recording NaN", async () => {
      const instrument = await connected(repl("Traceback (most recent call last):"));

      await expect(instrument.read("par")).rejects.toThrow(/not a number/);
    });

    it("refuses to read before a transport is attached", async () => {
      const instrument = new MicroPythonParReference();

      await expect(instrument.read("par")).rejects.toThrow(/not initialized/);
    });

    it("accepts a reply that was already buffered before the wait began", async () => {
      const transport = createMockTransport();
      vi.mocked(transport.send).mockImplementation((sent: string) => {
        if (sent === "getPAR()\r") transport.simulateData("getPAR()\r\n0.69\r\n>>> ");
        return Promise.resolve();
      });
      const instrument = await connected(transport);

      await expect(instrument.read("par")).resolves.toBe(0.69);
    });

    it("assembles a reply that arrives in pieces", async () => {
      const transport = createMockTransport();
      vi.mocked(transport.send).mockImplementation((sent: string) => {
        if (sent === "getPAR()\r") {
          setTimeout(() => transport.simulateData("getPAR()\r\n0."), 0);
          setTimeout(() => transport.simulateData("69\r\n>>> "), 5);
        }
        return Promise.resolve();
      });
      const instrument = await connected(transport);

      await expect(instrument.read("par")).resolves.toBe(0.69);
    });

    it("rejects when the board stays silent", async () => {
      const instrument = await connected(createMockTransport());

      await expect(instrument.read("par")).rejects.toThrow(/did not answer/);
    });

    it("discards an oversized receive buffer", async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const transport = createMockTransport();
      const instrument = new MicroPythonParReference({ readTimeoutMs: 50 }, logger);
      await instrument.initialize(transport);

      transport.simulateData("x".repeat(DEFAULT_MAX_BUFFER_SIZE + 1));

      expect(logger.error).toHaveBeenCalledWith(
        "MicroPython receive buffer exceeded max size, discarding data",
      );
    });
  });
});
