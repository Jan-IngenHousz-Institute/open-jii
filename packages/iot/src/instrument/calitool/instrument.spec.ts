import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { MockTransport } from "../../driver/testing/mock-transport";
import { createMockTransport } from "../../driver/testing/mock-transport";
import { identityMatches } from "../interface";
import { CALITOOL_LIMITS } from "./commands";
import { CalitoolSpectralBoard } from "./instrument";

const GREETING = "boot ok\r\nCaliTool v1.2\r\n";

interface BoardOptions {
  greeting?: string;
  ack?: string;
  channelValue?: string;
}

/** The board as the bench sees it: a greeting, an ack for every write, a value for every get. */
function board(options: BoardOptions = {}): MockTransport {
  const greeting = options.greeting ?? GREETING;
  const ack = options.ack ?? "OK\r\n";
  const channelValue = options.channelValue ?? "ch: 4211\r\n";

  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation((sent: string) => {
    const answerFor = () => {
      if (sent === "*IDN?\r") {
        return greeting;
      }
      if (sent.startsWith("get ")) {
        return channelValue;
      }
      return ack;
    };

    const answer = answerFor();
    setTimeout(() => transport.simulateData(answer), 0);
    return Promise.resolve();
  });
  return transport;
}

async function connected(transport: MockTransport): Promise<CalitoolSpectralBoard> {
  const instrument = new CalitoolSpectralBoard({
    identifyTimeoutMs: 200,
    settleTimeoutMs: 20,
    replyTimeoutMs: 200,
  });
  await instrument.initialize(transport);
  return instrument;
}

function payloadsSentTo(transport: MockTransport): string[] {
  return vi.mocked(transport.send).mock.calls.map(([payload]) => payload);
}

describe("CalitoolSpectralBoard", () => {
  it("identifies itself from the *IDN? reply", async () => {
    const transport = board();
    const instrument = await connected(transport);

    const reply = await instrument.identify();

    expect(reply).toContain("CaliTool");
    expect(transport.send).toHaveBeenCalledWith("*IDN?\r");
  });

  // The board greets with up to three lines and the identity is not always the first.
  it("finds the identity on the third line of the greeting", async () => {
    const transport = board({
      greeting: "boot ok\r\nspectral front end ready\r\nCaliTool v1.2\r\n",
    });
    const instrument = await connected(transport);

    const reply = await instrument.identify();

    expect(identityMatches(instrument, reply)).toBe(true);
    expect(reply).toBe("CaliTool v1.2");
  });

  // A greeting line left in the buffer would be read back as the next command's ack.
  it("drains the rest of the greeting so the next command reads its own answer", async () => {
    const transport = board({
      greeting: "CaliTool v1.2\r\nspectral front end ready\r\nself test passed\r\n",
      channelValue: "ch0: 512\r\n",
    });
    const instrument = await connected(transport);
    await instrument.identify();

    await expect(instrument.read("channel_0")).resolves.toBe(512);
  });

  it("hands back a foreign banner rather than claiming it", async () => {
    const transport = board({ greeting: "KIPRIM,DC310S,25011669,FV:V5.2.0\r\n" });
    const instrument = await connected(transport);

    const reply = await instrument.identify();

    expect(identityMatches(instrument, reply)).toBe(false);
    expect(reply).toContain("KIPRIM");
  });

  it("rejects when nothing answers the identity query", async () => {
    const instrument = await connected(createMockTransport());

    await expect(instrument.identify()).rejects.toThrow(/did not answer/);
  });

  it("assembles a reply that arrives in pieces", async () => {
    const transport = createMockTransport();
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("CaliT"), 0);
      setTimeout(() => transport.simulateData("ool v1.2\r\n"), 5);
      return Promise.resolve();
    });
    const instrument = await connected(transport);

    await expect(instrument.identify()).resolves.toBe("CaliTool v1.2");
  });

  it("writes every setpoint in the board's exact wire form", async () => {
    const transport = board();
    const instrument = await connected(transport);

    await instrument.applySetpoint("led_ma", 120);
    await instrument.applySetpoint("gain", 6);
    await instrument.applySetpoint("atime", 100);
    await instrument.applySetpoint("astep", 999);

    expect(payloadsSentTo(transport)).toEqual([
      "setled 120\r",
      "setGain 6\r",
      "setAtime 100\r",
      "setAstep 999\r",
    ]);
  });

  it("declares its setpoints and its twelve channels", () => {
    const instrument = new CalitoolSpectralBoard();

    expect(instrument.setpoints.map((setpoint) => setpoint.name)).toEqual([
      "led_ma",
      "gain",
      "atime",
      "astep",
    ]);
    expect(instrument.readings).toHaveLength(CALITOOL_LIMITS.CHANNEL_COUNT);
    expect(instrument.readings.map((reading) => reading.name)).toContain("channel_11");
    expect(instrument.readings.every((reading) => reading.unit === "count")).toBe(true);
  });

  describe("readings", () => {
    it("measures, then reads the channel, and returns the count", async () => {
      const transport = board({ channelValue: "ch5: 4211\r\n" });
      const instrument = await connected(transport);

      await expect(instrument.read("channel_5")).resolves.toBe(4211);
      expect(payloadsSentTo(transport)).toEqual(["measure\r", "get 5\r"]);
    });

    it("fails a read the board does not acknowledge the measurement of", async () => {
      const transport = board({ ack: "ERR busy\r\n" });
      const instrument = await connected(transport);

      await expect(instrument.read("channel_0")).rejects.toThrow(/to measure, not OK/);
    });

    it("refuses an answer with no value after a colon", async () => {
      const transport = board({ channelValue: "4211\r\n" });
      const instrument = await connected(transport);

      await expect(instrument.read("channel_0")).rejects.toThrow(/no value after a colon/);
    });

    it("refuses a non-numeric answer rather than recording NaN", async () => {
      const transport = board({ channelValue: "ch0: saturated\r\n" });
      const instrument = await connected(transport);

      await expect(instrument.read("channel_0")).rejects.toThrow(/not a channel count/);
    });

    it("refuses a reading it does not have", async () => {
      const instrument = await connected(board());

      await expect(instrument.read("channel_12")).rejects.toThrow(/no reading "channel_12"/);
    });
  });

  describe("guards", () => {
    it("refuses a setpoint it does not have", async () => {
      const instrument = await connected(board());

      await expect(instrument.applySetpoint("current_a", 1)).rejects.toThrow(
        /no setpoint "current_a"/,
      );
    });

    // Every setpoint is a register count, so a fraction is refused rather than rounded.
    it("refuses a fractional setpoint instead of rounding it", async () => {
      const instrument = await connected(board());

      await expect(instrument.applySetpoint("led_ma", 12.5)).rejects.toThrow(
        /must be a whole number/,
      );
      await expect(instrument.applySetpoint("gain", Number.NaN)).rejects.toThrow(
        /must be a whole number/,
      );
    });

    it("refuses each setpoint above its ceiling", async () => {
      const instrument = await connected(board());

      await expect(
        instrument.applySetpoint("led_ma", CALITOOL_LIMITS.LED_MAX_MA + 1),
      ).rejects.toThrow(/between 0 and 250 mA/);
      await expect(instrument.applySetpoint("gain", CALITOOL_LIMITS.GAIN_MAX + 1)).rejects.toThrow(
        /between 0 and 10 step/,
      );
      await expect(
        instrument.applySetpoint("atime", CALITOOL_LIMITS.ATIME_MAX + 1),
      ).rejects.toThrow(/between 1 and 255 count/);
      await expect(
        instrument.applySetpoint("astep", CALITOOL_LIMITS.ASTEP_MAX + 1),
      ).rejects.toThrow(/between 1 and 65535 count/);
    });

    it("refuses each setpoint below its floor", async () => {
      const instrument = await connected(board());

      await expect(instrument.applySetpoint("led_ma", -1)).rejects.toThrow(/between 0 and 250 mA/);
      await expect(instrument.applySetpoint("gain", -1)).rejects.toThrow(/between 0 and 10 step/);
      await expect(instrument.applySetpoint("atime", 0)).rejects.toThrow(/between 1 and 255 count/);
      await expect(instrument.applySetpoint("astep", 0)).rejects.toThrow(
        /between 1 and 65535 count/,
      );
    });

    it("fails a write the board answers with an error", async () => {
      const instrument = await connected(board({ ack: "ERR range\r\n" }));

      await expect(instrument.applySetpoint("gain", 3)).rejects.toThrow(/to gain, not OK/);
    });

    it("fails a write the board never acknowledges", async () => {
      const transport = createMockTransport();
      const instrument = await connected(transport);

      await expect(instrument.applySetpoint("gain", 3)).rejects.toThrow(/did not answer/);
    });

    it("refuses to act before a transport is attached", async () => {
      const instrument = new CalitoolSpectralBoard();

      await expect(instrument.applySetpoint("led_ma", 1)).rejects.toThrow(
        /transport not initialized/i,
      );
      await expect(instrument.read("channel_0")).rejects.toThrow(/transport not initialized/i);
    });
  });

  describe("shutdown", () => {
    // A board left lit heats and biases whatever is under it.
    it("darkens the board", async () => {
      const transport = board();
      const instrument = await connected(transport);
      await instrument.applySetpoint("led_ma", 120);
      vi.mocked(transport.send).mockClear();

      await instrument.shutdown();

      expect(transport.send).toHaveBeenCalledWith("setled 0\r");
    });

    // The rig rests its instruments with the ports still open, so whatever this write
    // leaves behind is what the next command reads.
    it("reads the answer to its own write, leaving nothing for the next command", async () => {
      const transport = board();
      const instrument = await connected(transport);

      await instrument.shutdown();

      await expect(instrument.read("channel_0")).resolves.toBe(4211);
    });

    it("reports a board that refuses to darken", async () => {
      const transport = board({ ack: "ERR busy\r\n" });
      const instrument = await connected(transport);

      await expect(instrument.shutdown()).rejects.toThrow(/ERR busy/);
    });

    it("is a no-op when no transport was ever attached", async () => {
      await expect(new CalitoolSpectralBoard().shutdown()).resolves.toBeUndefined();
    });

    it("darkens the board before dropping the transport", async () => {
      const transport = board();
      const instrument = await connected(transport);

      await instrument.destroy();

      expect(payloadsSentTo(transport)).toEqual(["setled 0\r"]);
      await expect(instrument.applySetpoint("led_ma", 1)).rejects.toThrow(
        /transport not initialized/i,
      );
    });

    it("still releases the transport when the darkening write fails", async () => {
      const transport = board();
      const instrument = await connected(transport);
      vi.mocked(transport.send).mockRejectedValue(new Error("port closed"));

      await expect(instrument.destroy()).resolves.toBeUndefined();
      await expect(instrument.read("channel_0")).rejects.toThrow(/transport not initialized/i);
    });
  });

  describe("the receive buffer", () => {
    it("discards an oversized buffer instead of growing it, and reads cleanly afterwards", async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const transport = board();
      const instrument = new CalitoolSpectralBoard(
        { identifyTimeoutMs: 200, settleTimeoutMs: 20, replyTimeoutMs: 200 },
        logger,
      );
      await instrument.initialize(transport);

      transport.simulateData("x".repeat(DEFAULT_MAX_BUFFER_SIZE + 1));

      expect(logger.error).toHaveBeenCalledWith(
        "Spectral tool board receive buffer exceeded max size, discarding data",
      );
      // The flood is gone rather than merely reported: the next reading is its own.
      await expect(instrument.read("channel_0")).resolves.toBe(4211);
    });
  });
});
