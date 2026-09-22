import { beforeEach, describe, expect, it, vi } from "vitest";

import { AmbitDriver } from "../driver/ambit/driver";
import { MiniParDriver } from "../driver/minipar/driver";
import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import {
  canWriteCalibration,
  formatCoefficient,
  writableCalibrationBlocks,
  writeCalibrationBlocks,
} from "./write-back";

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
  // The console stores the float it parsed and prints it back at two decimals.
  const printed = (value: number) => value.toFixed(2);

  function reply(line: string): string {
    const [name, first, second] = line.split(",");
    switch (name) {
      case "cal_par_slope":
        state.slope = Number(first);
        return `\n${printed(Number(first))}\n`;
      case "cal_par_intercept":
        state.intercept = Number(first);
        return `\n${printed(Number(first))}\n`;
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

interface AmbitState {
  spec: number;
  act: number;
  adpd: number[];
}

/** The dump `reboot` prints, carrying the coefficients the device holds by then. */
function ambitBootDump(state: AmbitState): string {
  return [
    "rst:0x1 boot:0x13",
    `Calibration: ADPD: ${state.adpd.join("\t")}`,
    `Calibration: Name:AmbitV004 Actinic:${state.act.toFixed(4)} Spec:${state.spec.toFixed(4)} Emit:0.9910`,
    "FW: MAC:A0:B1:C2:D3:E4:F5\tSize:1245184\tDate:Mar  5 2026",
    "FW: 1.1.3",
    "",
  ].join("\n");
}

/**
 * An Ambit console as the firmware behaves: the gain writers answer nothing at all,
 * the baseline writer answers its one fixed line, and `reboot` prints what the device
 * now holds. The wake handshake belongs to the driver, so only the write-back's own
 * lines are recorded.
 */
function ambitConsole(overrides: Partial<Record<string, string>> = {}): MockTransport & {
  sent: string[];
  state: AmbitState;
} {
  const transport = createMockTransport();
  const sent: string[] = [];
  const state: AmbitState = { spec: 1, act: 1, adpd: [0, 0, 0, 0, 0, 0] };

  function reply(line: string): string {
    const [name, ...args] = line.split(",");
    switch (name) {
      case "hello":
        return "NEW Bench Ready\n";
      case "set_spec":
        state.spec = Number(args[0]);
        return "";
      case "set_act":
        state.act = Number(args[0]);
        return "";
      case "set_baseline":
        state.adpd = args.map(Number);
        return "Baseline saved and verified\n";
      case "reboot":
        return ambitBootDump(state);
      default:
        return "BAD COMMAND\n";
    }
  }

  vi.mocked(transport.send).mockImplementation((payload: string) => {
    const line = payload.trim();
    const [name = ""] = line.split(",");
    if (name !== "hello") {
      sent.push(line);
    }
    const answer = overrides[name] ?? reply(line);
    setTimeout(() => transport.simulateData(answer), 0);
    return Promise.resolve();
  });
  return Object.assign(transport, { sent, state });
}

const noSleep = { sleep: () => Promise.resolve() };
const MINIPAR_BLOCKS = { par: { coefficients: { slope: 0.96, intercept: -1.08 } } };
const AMBIT_BASELINE = [1021, 987, 1103, 954, 1200, 1015];
const AMBIT_BLOCKS = {
  par: { coefficients: { spec: 1.1893 } },
  led: { coefficients: { act: 0.2412 } },
  baseline: { coefficients: { channels: AMBIT_BASELINE } },
};
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

  it("accepts the Ambit gain and baseline blocks", () => {
    expect(canWriteCalibration("ambit", AMBIT_BLOCKS)).toBe(true);
  });

  it("refuses a family with no writers", () => {
    expect(canWriteCalibration("multispeq", MINIPAR_BLOCKS)).toBe(false);
  });

  it("refuses a coefficient the family has no command for", () => {
    expect(canWriteCalibration("minipar", { par: { coefficients: { gain: 2 } } })).toBe(false);
  });

  // A device whose vendor tool owns one coefficient would otherwise have its entire
  // calibration recorded and never written, under a message blaming the family.
  it("offers the write when only some blocks can be written", () => {
    const mixed = { ...MINIPAR_BLOCKS, telemetry: { coefficients: { gain: 2 } } };

    expect(writableCalibrationBlocks("minipar", mixed)).toEqual(["par"]);
    expect(canWriteCalibration("minipar", mixed)).toBe(true);
  });

  it("names nothing writable for a family with no writers at all", () => {
    expect(writableCalibrationBlocks("multispeq", MINIPAR_BLOCKS)).toEqual([]);
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

  // A real fit is not two-decimal exact, and the console prints its echo at two decimals
  // while storing the whole float. Comparing the echo at full precision would fail every
  // such write, stop the block before its second coefficient, and leave the sensor with a
  // new slope against its old offset.
  it("writes a fit the console can only echo to two decimals, and confirms it from the readback", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "minipar",
      { par: { coefficients: { slope: 0.963412, intercept: -1.0826 } } },
      noSleep,
    );

    expect(results).toEqual({ par: { verified: true } });
    expect(transport.sent).toEqual([
      "cal_par_slope,0.963412",
      "cal_par_intercept,-1.0826",
      "get_cal_par",
    ]);
    expect(transport.state).toMatchObject({ slope: 0.963412, intercept: -1.0826 });
  });

  // The echo still has to be the number that was sent, at the precision it is printed with.
  it("reports a coefficient the console echoed as a different number", async () => {
    const transport = miniparConsole({ cal_par_slope: "\n0.42\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "minipar",
      { par: { coefficients: { slope: 0.963412 } } },
      noSleep,
    );

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/did not confirm "par.slope"/);
  });

  // The bench procedure sleeps 300 ms between the two writes so the console keeps up.
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

  // The writers used to be resolved as the block was sent, so a block with one uncovered
  // coefficient was already half on the device when the refusal came back.
  it("refuses a block with one uncovered coefficient before sending any of it", async () => {
    const transport = miniparConsole();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "minipar",
      { par: { coefficients: { slope: 0.96, gain: 1.5 } } },
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

describe("writeCalibrationBlocks to an Ambit device", () => {
  let driver: AmbitDriver;

  beforeEach(() => {
    vi.useRealTimers();
    // A reboot dump ends on the console going quiet, and the firmware pauses mid-dump,
    // so each of these spends the command's real 1.5 s window. Given room rather than
    // left at the default, where a loaded machine turns the margin into a flake.
    vi.setConfig({ testTimeout: 20_000 });
    driver = new AmbitDriver({ quietWindowMs: 20, timeoutMs: 500 });
  });

  // The gains answer nothing and the boot dump is the only readback, so a session
  // that writes everything still reboots the device once.
  it("writes both gains and the baseline, then reads all three back from one reboot", async () => {
    const transport = ambitConsole();
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "ambit", AMBIT_BLOCKS, noSleep);

    expect(results).toEqual({
      par: { verified: true },
      led: { verified: true },
      baseline: { verified: true },
    });
    expect(transport.sent).toEqual([
      "set_spec, 1.1893",
      "set_act, 0.2412",
      "set_baseline,1021,987,1103,954,1200,1015",
      "reboot",
    ]);
  });

  // The baseline is the one Ambit writer that answers, and only one line counts.
  it("reports the baseline unverified with what the device said instead", async () => {
    const transport = ambitConsole({ set_baseline: "Baseline mismatch: channel 3\n" });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { baseline: { coefficients: { channels: AMBIT_BASELINE } } },
      noSleep,
    );

    expect(results.baseline.verified).toBe(false);
    expect(results.baseline.error).toMatch(/Baseline mismatch: channel 3/);
    expect(transport.sent).toEqual(["set_baseline,1021,987,1103,954,1200,1015"]);
  });

  // A gain the dump disagrees with leaves that block unverified and nothing else:
  // the operator re-runs the sweep, the platform does not roll the device back.
  it("reports the gain whose boot dump disagrees unverified, and leaves the device alone", async () => {
    const transport = ambitConsole({
      reboot: ambitBootDump({ spec: 1.18, act: 0.2412, adpd: AMBIT_BASELINE }),
    });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "ambit", AMBIT_BLOCKS, noSleep);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/holds 1.18 for "par.spec" after writing 1.1893/);
    expect(results.led).toEqual({ verified: true });
    expect(results.baseline).toEqual({ verified: true });
    // Nothing follows the reboot: the device keeps what it was given.
    expect(transport.sent).toEqual([
      "set_spec, 1.1893",
      "set_act, 0.2412",
      "set_baseline,1021,987,1103,954,1200,1015",
      "reboot",
    ]);
  });

  it("reports a block unverified when the boot dump never reaches its calibration line", async () => {
    const transport = ambitConsole({ reboot: "rst:0x1 boot:0x13\n" });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { par: { coefficients: { spec: 1.1893 } } },
      noSleep,
    );

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/could not be read/);
  });

  // A dump that reaches its version line but not its coefficients parses to zeros, and
  // "the device holds 0" is a different and much worse claim than "nobody could read it".
  it("does not read a dump that stops after the version line as a device holding zero", async () => {
    const transport = ambitConsole({ reboot: "rst:0x1 boot:0x13\nFW: 1.1.3\n" });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { par: { coefficients: { spec: 1.1893 } } },
      noSleep,
    );

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/could not be read/);
    expect(results.par.error).not.toMatch(/holds 0/);
  });

  // The gain goes on the wire with four decimals, so the dump can only ever answer four.
  // Without a tolerance matched to that, every fit with more digits reads as a bad write.
  it("accepts a dump that holds the four decimals the gain was written with", async () => {
    const transport = ambitConsole();
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { par: { coefficients: { spec: 1.189347 } } },
      noSleep,
    );

    expect(results.par).toEqual({ verified: true });
    expect(transport.sent).toEqual(["set_spec, 1.1893", "reboot"]);
  });

  it("names the value the wire carried when a gain disagrees, not the one behind it", async () => {
    const transport = ambitConsole({
      reboot: ambitBootDump({ spec: 1.18, act: 1, adpd: [0, 0, 0, 0, 0, 0] }),
    });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { par: { coefficients: { spec: 1.189347 } } },
      noSleep,
    );

    expect(results.par.error).toMatch(/after writing 1.1893$/);
  });

  // The gains print nothing, so the driver's own fire, settle and hello re-verify is the
  // only sign the console took the write at all.
  it("reports a gain the console never came back ready from", async () => {
    const transport = ambitConsole({ hello: "still busy\n" });
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { par: { coefficients: { spec: 1.1893 } } },
      noSleep,
    );

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/set_spec/);
  });

  // One command carries all six channels, so a value the firmware cannot store must
  // never reach the wire: half a baseline is worse than none.
  it("refuses a baseline channel outside the device's range before writing anything", async () => {
    const transport = ambitConsole();
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { baseline: { coefficients: { channels: [1021, 987, 1103, 954, 1200, 16_777_216] } } },
      noSleep,
    );

    expect(results.baseline.verified).toBe(false);
    expect(results.baseline.error).toMatch(/needs whole numbers in \[0, 16777215\]/);
    expect(transport.sent).toEqual([]);
  });

  it("refuses a scalar on the baseline writer", async () => {
    const transport = ambitConsole();
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { baseline: { coefficients: { channels: 1021 } } },
      noSleep,
    );

    expect(results.baseline.error).toMatch(/not an array/);
    expect(transport.sent).toEqual([]);
  });

  it("refuses a baseline that is not six channels before writing anything", async () => {
    const transport = ambitConsole();
    await driver.initialize(transport);

    const results = await writeCalibrationBlocks(
      driver,
      "ambit",
      { baseline: { coefficients: { channels: [1021, 987, 1103] } } },
      noSleep,
    );

    expect(results.baseline.error).toMatch(/needs 6 values, not 3/);
    expect(transport.sent).toEqual([]);
  });
});
