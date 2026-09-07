import { beforeEach, describe, expect, it, vi } from "vitest";

import { MiniParDriver } from "../driver/minipar/driver";
import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import { canWriteCalibration, formatCoefficient, writeCalibrationBlocks } from "./write-back";

/** A MiniPAR console: calibration writers echo the value they were sent. */
function echoingTransport(overrides: Partial<Record<string, string>> = {}): MockTransport & {
  sent: string[];
} {
  const transport = createMockTransport();
  const sent: string[] = [];
  vi.mocked(transport.send).mockImplementation((payload: string) => {
    sent.push(payload.trim());
    const [name, value] = payload.trim().split(",");
    const reply = overrides[name] ?? `\n${value}\n`;
    setTimeout(() => transport.simulateData(reply), 0);
    return Promise.resolve();
  });
  return Object.assign(transport, { sent });
}

const MINIPAR_BLOCKS = { par: { coefficients: { slope: 0.96, intercept: -1.08 } } };

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

  it("writes each coefficient as its console command and verifies the echo", async () => {
    const transport = echoingTransport();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS);

    expect(results).toEqual({ par: { verified: true } });
    expect(transport.sent).toEqual(["cal_par_slope,0.96", "cal_par_intercept,-1.08"]);
  });

  // A wrong echo is the only signal that a write did not take.
  it("reports a block unverified when the echo disagrees", async () => {
    const transport = echoingTransport({ cal_par_intercept: "\n0.00\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/did not confirm "par.intercept"/);
  });

  it("stops a block at its first failure so a half-written block is never good", async () => {
    const transport = echoingTransport({ cal_par_slope: "\nERR\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS);

    expect(results.par.verified).toBe(false);
    expect(transport.sent).toEqual(["cal_par_slope,0.96"]);
  });

  it("surfaces a firmware error reply as the block's error", async () => {
    const transport = echoingTransport({ cal_par_slope: "error:out_of_range\n" });
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", MINIPAR_BLOCKS);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/error:out_of_range/);
  });

  it("refuses an array coefficient on a scalar writer", async () => {
    const transport = echoingTransport();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "minipar", {
      par: { coefficients: { slope: [1, 2, 3] } },
    });

    expect(results.par.error).toMatch(/not a scalar/);
    expect(transport.sent).toEqual([]);
  });

  it("reports every block of an unsupported family without touching the device", async () => {
    const transport = echoingTransport();
    driver.initialize(transport);

    const results = await writeCalibrationBlocks(driver, "multispeq", MINIPAR_BLOCKS);

    expect(results.par.verified).toBe(false);
    expect(results.par.error).toMatch(/cannot write calibrations to a multispeq/);
    expect(transport.sent).toEqual([]);
  });
});
