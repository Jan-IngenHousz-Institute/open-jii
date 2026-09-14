import { beforeEach, describe, expect, it, vi } from "vitest";

import { MiniParDriver } from "../driver/minipar/driver";
import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import { canWriteCalibration, formatCoefficient, writeCalibrationBlocks } from "./write-back";

interface ConsoleState {
  slope: number;
  intercept: number;
  channels: number[];
}

/**
 * A MiniPAR console as the firmware behaves: writers echo what they stored, the
 * spectral writer answers in JSON with six decimals, and both readbacks report the
 * stored values with six decimals.
 */
function miniparConsole(overrides: Partial<Record<string, string>> = {}): MockTransport & {
  sent: string[];
  state: ConsoleState;
} {
  const transport = createMockTransport();
  const sent: string[] = [];
  const state: ConsoleState = { slope: 1, intercept: 0, channels: new Array<number>(18).fill(0) };
  const six = (value: number) => value.toFixed(6);

  function reply(line: string): string {
    const [name, first, second] = line.split(",");
    switch (name) {
      case "cal_par_slope":
        state.slope = Number(first);
        return `\n${first}\n`;
      case "cal_par_intercept":
        state.intercept = Number(first);
        return `\n${first}\n`;
      case "get_cal_par":
        return `\nslope=${six(state.slope)},intercept=${six(state.intercept)}\n`;
      case "set_spec_coeff":
        state.channels[Number(first)] = Number(second);
        return `{"spectrometer_coeff":{"channel":${first},"value":${six(Number(second))}}}\n`;
      case "get_spec_coeff":
        return `\n${state.channels.map(six).join(",")}\n`;
      default:
        return "error:unknown_command\n";
    }
  }

  vi.mocked(transport.send).mockImplementation((payload: string) => {
    const line = payload.trim();
    sent.push(line);
    const [name = ""] = line.split(",");
    const answer = overrides[name] ?? reply(line);
    setTimeout(() => transport.simulateData(answer), 0);
    return Promise.resolve();
  });
  return Object.assign(transport, { sent, state });
}

const noSleep = { sleep: () => Promise.resolve() };
const MINIPAR_BLOCKS = { par: { coefficients: { slope: 0.96, intercept: -1.08 } } };
const SPECTRAL = [
  0.00785574, 0.00343847, 0.00284895, 0.00289513, 0.00246484, 0.00230161, 0.0025635, 0.000852164,
  -0.000739113, 0,
];
const SPECTRAL_BLOCKS = { spec: { coefficients: { channel_coefficients: SPECTRAL } } };

/** The 18-channel readback line for the written coefficients, with one channel replaced. */
function spectralReadback(replaceIndex: number, replacement: number): string {
  const held = [...SPECTRAL, ...new Array<number>(8).fill(0)];
  held[replaceIndex] = replacement;
  return `\n${held.map((value) => value.toFixed(6)).join(",")}\n`;
}

describe("formatCoefficient", () => {
  it("keeps six significant digits and drops trailing zeros", () => {
    expect(formatCoefficient(0.96)).toBe("0.96");
    expect(formatCoefficient(1.189347)).toBe("1.18935");
    expect(formatCoefficient(-1.08)).toBe("-1.08");
    expect(formatCoefficient(100)).toBe("100");
  });
});

describe("canWriteCalibration", () => {
  it("accepts MiniPAR PAR blocks", () => {
    expect(canWriteCalibration("minipar", MINIPAR_BLOCKS)).toBe(true);
  });

  it("accepts the MiniPAR spectral block", () => {
    expect(canWriteCalibration("minipar", SPECTRAL_BLOCKS)).toBe(true);
  });

  it("refuses a family with no writers", () => {
    expect(canWriteCalibration("multispeq", MINIPAR_BLOCKS)).toBe(false);
  });

  it("refuses a coefficient the family has no command for", () => {
    expect(canWriteCalibration("minipar", { par: { coefficients: { gain: 2 } } })).toBe(false);
  });
});

describe("writeCalibrationBlocks", () => {
  let driver: MiniParDriver;

  beforeEach(() => {
    vi.useRealTimers();
    driver = new MiniParDriver({ timeoutMs: 500, protocolTimeoutMs: 500 });
  });

  it("writes each coefficient as its console command, verifies the echo, then reads the block back", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results).toEqual({ par: { verified: true } });
    expect(transport.sent).toEqual([
      "cal_par_slope,0.96",
      "cal_par_intercept,-1.08",
      "get_cal_par",
    ]);
  });

  // The bench procedure sleeps 300 ms between the two writes; back to back, the second is lost.
  it("pauses between consecutive console writes by the family's gap", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);
    const sleep = vi.fn(() => Promise.resolve());

    await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, { sleep });

    expect(sleep.mock.calls).toEqual([[300], [300]]);
  });

  // A wrong echo is the first signal that a write did not take.
  it("reports a block unverified when the echo disagrees", async () => {
    const transport = miniparConsole({ cal_par_intercept: "\n0.00\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/did not confirm "par.intercept"/);
  });

  // The echo can agree while the stored value does not; the readback is the last word.
  it("reports a block unverified when the readback disagrees with what was written", async () => {
    const transport = miniparConsole({ get_cal_par: "\nslope=0.950000,intercept=-1.080000\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/holds 0.95 for "par.slope" after writing 0.96/);
  });

  it("reports a block unverified when the readback leaves out a written coefficient", async () => {
    const transport = miniparConsole({ get_cal_par: "\nslope=0.960000\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/does not report "intercept"/);
  });

  it("reports a block unverified when the readback cannot be read", async () => {
    const transport = miniparConsole({ get_cal_par: "\n???\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/could not be read/);
  });

  // Older firmware has no readback command; the echoes then stand on their own.
  it("lets the echoes stand when the firmware has no readback command", async () => {
    const transport = miniparConsole({ get_cal_par: "error:unknown_command\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results).toEqual({ par: { verified: true } });
  });

  it("reports a block unverified when the device stops answering at the readback", async () => {
    const transport = miniparConsole({ get_cal_par: "" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/timeout/i);
  });

  it("stops a block at its first failure so a half-written block is never good", async () => {
    const transport = miniparConsole({ cal_par_slope: "\nERR\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(transport.sent).toEqual(["cal_par_slope,0.96"]);
  });

  it("surfaces a firmware error reply as the block's error", async () => {
    const transport = miniparConsole({ cal_par_slope: "error:out_of_range\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/error:out_of_range/);
  });

  describe("array coefficients", () => {
    it("writes one entry per command, paced, verifies each JSON echo, and checks the readback prefix", async () => {
      const transport = miniparConsole();
      driver.initialize(transport);
      const sleep = vi.fn(() => Promise.resolve());

      const results = await writeCalibrationBlocks(driver, "minipar", SPECTRAL_BLOCKS, { sleep });

      expect(results).toEqual({ spec: { verified: true } });
      expect(transport.sent.slice(0, 2)).toEqual([
        "set_spec_coeff,0,0.00785574",
        "set_spec_coeff,1,0.00343847",
      ]);
      expect(transport.sent).toHaveLength(SPECTRAL.length + 1);
      expect(transport.sent[SPECTRAL.length]).toBe("get_spec_coeff");
      // 100 ms between the ten entries, then the family gap before the readback.
      expect(sleep.mock.calls).toEqual([...Array<[number]>(9).fill([100]), [300]]);
    });

    // The device holds 18 channels and a definition may write fewer; the written prefix must match.
    it("reports an array unverified when a written channel reads back differently", async () => {
      const transport = miniparConsole({ get_spec_coeff: spectralReadback(2, 0.5) });
      driver.initialize(transport);

      const results = await writeCalibrationBlocks(driver, "minipar", SPECTRAL_BLOCKS, noSleep);

      expect(results.spec.verified).toBe(false);
      expect(results.spec.error).toMatch(/holds .* for "spec.channel_coefficients"/);
    });

    it("ignores channels the definition did not write", async () => {
      const transport = miniparConsole({ get_spec_coeff: spectralReadback(17, 0.5) });
      driver.initialize(transport);

      const results = await writeCalibrationBlocks(driver, "minipar", SPECTRAL_BLOCKS, noSleep);

      expect(results).toEqual({ spec: { verified: true } });
    });

    it("stops the array at the first entry the device does not confirm", async () => {
      const transport = miniparConsole({
        set_spec_coeff: '{"spectrometer_coeff":{"channel":0,"value":0.000000}}\n',
      });
      driver.initialize(transport);

      const results = await writeCalibrationBlocks(driver, "minipar", SPECTRAL_BLOCKS, noSleep);

      expect(results.spec.verified).toBe(false);
      expect(results.spec.error).toMatch(/did not confirm "spec.channel_coefficients\[0\]"/);
      expect(transport.sent).toEqual(["set_spec_coeff,0,0.00785574"]);
    });

    it("refuses an array coefficient on a scalar writer", async () => {
      const transport = miniparConsole();
      driver.initialize(transport);

      const results = await writeCalibrationBlocks(
        driver,
        "minipar",
        { par: { coefficients: { slope: [1, 2, 3] } } },
        noSleep,
      );

      expect(results.par.error).toMatch(/not a scalar/);
      expect(transport.sent).toEqual([]);
    });

    it("refuses a scalar on an array writer", async () => {
      const transport = miniparConsole();
      driver.initialize(transport);

      const results = await writeCalibrationBlocks(
        driver,
        "minipar",
        { spec: { coefficients: { channel_coefficients: 0.5 } } },
        noSleep,
      );

      expect(results.spec.error).toMatch(/not an array/);
      expect(transport.sent).toEqual([]);
    });
  });

  it("reports a block the family has no writers for without touching the device", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "minipar",
      { tph: { coefficients: { offset: 0.5 } } },
      noSleep,
    );

    expect(results.tph).toEqual({ verified: false, error: 'No writers for block "tph"' });
    expect(transport.sent).toEqual([]);
  });

  it("reports a coefficient the family has no command for without touching the device", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "minipar",
      { par: { coefficients: { gain: 1.5 } } },
      noSleep,
    );

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/No writer for coefficient "par.gain"/);
    expect(transport.sent).toEqual([]);
  });

  it("reports every block of an unsupported family without touching the device", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "multispeq", MINIPAR_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/cannot write calibrations to a multispeq/);
    expect(transport.sent).toEqual([]);
  });
});
